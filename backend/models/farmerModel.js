const prisma = require('../config/prisma');

const profileInclude = {
  users: { select: { user_id: true, full_name: true, email: true, phone_number: true, profile_picture_url: true } },
  villages: {
    select: {
      village_name: true,
      cells: { select: { sectors: { select: { districts: { select: { district_name: true } } } } } },
    },
  },
};

function mapProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.users.user_id,
    fullName: profile.users.full_name,
    email: profile.users.email,
    phone: profile.users.phone_number,
    profilePictureUrl: profile.users.profile_picture_url,
    farmerId: profile.farmer_id,
    farmDescription: profile.farm_description,
    district: profile.villages.cells.sectors.districts.district_name,
    generalLocation: profile.villages.village_name,
    villageId: profile.village_id,
  };
}

async function getProfile(userId) {
  const profile = await prisma.farmer_profiles.findUnique({ where: { user_id: Number(userId) }, include: profileInclude });
  return mapProfile(profile);
}

async function findVillage(client, district, village) {
  const record = await client.villages.findFirst({
    where: { village_name: village, cells: { sectors: { districts: { district_name: district } } } },
    select: { village_id: true },
  });
  return record?.village_id ?? null;
}

async function updateProfile(userId, data) {
  const profile = await prisma.farmer_profiles.findUnique({ where: { user_id: Number(userId) }, select: { farmer_id: true } });
  if (!profile) return null;
  await prisma.$transaction(async (tx) => {
    const userData = {};
    for (const [key, field] of [['fullName', 'full_name'], ['email', 'email'], ['phone', 'phone_number'], ['profilePictureUrl', 'profile_picture_url']]) {
      if (data[key] !== undefined) userData[field] = data[key];
    }
    if (Object.keys(userData).length) await tx.users.update({ where: { user_id: Number(userId) }, data: userData });

    const profileData = {};
    if (data.farmDescription !== undefined) profileData.farm_description = data.farmDescription || null;
    if (data.district !== undefined || data.generalLocation !== undefined) {
      if (!data.district || !data.generalLocation) throw Object.assign(new Error('Both district and generalLocation are required to change location'), { status: 400 });
      const villageId = await findVillage(tx, data.district, data.generalLocation);
      if (!villageId) throw Object.assign(new Error('Location must match a configured district and village'), { status: 400 });
      profileData.village_id = villageId;
    }
    if (Object.keys(profileData).length) await tx.farmer_profiles.update({ where: { user_id: Number(userId) }, data: profileData });
  }, { isolationLevel: 'Serializable' });
  return getProfile(userId);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function getDashboard(userId) {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const productWhere = { farmer_id: profile.farmerId, archived_at: null };
  const inquiryWhere = { products: { farmer_id: profile.farmerId } };
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - 11);
  const [totalProducts, availability, pending, accepted, declined, byCategory, monthlyProducts, inquiryStatuses] = await Promise.all([
    prisma.products.count({ where: productWhere }),
    prisma.products.groupBy({ by: ['availability_status'], where: productWhere, _count: { _all: true } }),
    prisma.inquiries.count({ where: { ...inquiryWhere, inquiry_status: 'pending' } }),
    prisma.inquiries.count({ where: { ...inquiryWhere, inquiry_status: 'accepted' } }),
    prisma.inquiries.count({ where: { ...inquiryWhere, inquiry_status: 'rejected' } }),
    prisma.products.groupBy({ by: ['category_id'], where: productWhere, _count: { _all: true }, orderBy: { _count: { product_id: 'desc' } } }),
    prisma.products.findMany({ where: { ...productWhere, created_at: { gte: start } }, select: { created_at: true } }),
    prisma.inquiries.groupBy({ by: ['inquiry_status'], where: inquiryWhere, _count: { _all: true } }),
  ]);
  const [categories, allStatus] = await Promise.all([
    prisma.categories.findMany({ where: { category_id: { in: byCategory.map((row) => row.category_id) } }, select: { category_id: true, category_name: true } }),
    prisma.products.count({ where: { ...productWhere, availability_status: 'unavailable' } }),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.category_id, category.category_name]));
  const monthTotals = new Map();
  for (const product of monthlyProducts) {
    const key = monthKey(product.created_at);
    monthTotals.set(key, (monthTotals.get(key) || 0) + 1);
  }
  const availableProducts = availability.find((row) => row.availability_status === 'available')?._count._all || 0;
  return {
    farmer: { id: profile.id, fullName: profile.fullName, email: profile.email, profilePictureUrl: profile.profilePictureUrl },
    summary: {
      totalProducts,
      availableProducts,
      unavailableProducts: allStatus,
      pendingInquiries: pending,
      acceptedInquiries: accepted,
      declinedInquiries: declined,
    },
    charts: {
      productsByCategory: byCategory.map((row) => ({ categoryId: row.category_id, category: categoryNames.get(row.category_id), total: row._count._all })),
      productAvailability: availability.map((row) => ({ status: row.availability_status, total: row._count._all })),
      monthlyListings: [...monthTotals].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total })),
      inquiryStatuses: inquiryStatuses.map((row) => ({ status: row.inquiry_status === 'rejected' ? 'declined' : row.inquiry_status, total: row._count._all })),
    },
  };
}

async function listCategories() {
  const rows = await prisma.categories.findMany({ orderBy: { category_name: 'asc' }, select: { category_id: true, category_name: true } });
  return rows.map((row) => ({ id: row.category_id, name: row.category_name }));
}

async function getFarmerId(userId, client = prisma) {
  const profile = await client.farmer_profiles.findUnique({ where: { user_id: Number(userId) }, select: { farmer_id: true, village_id: true } });
  return profile ? { id: profile.farmer_id, villageId: profile.village_id } : null;
}

const productInclude = {
  categories: { select: { category_name: true } },
  villages: { select: { village_name: true, cells: { select: { sectors: { select: { districts: { select: { district_name: true } } } } } } } },
  product_images: { select: { image_url: true }, orderBy: { image_id: 'asc' }, take: 1 },
};

function mapProduct(product) {
  if (!product) return null;
  return {
    id: product.product_id,
    name: product.product_name,
    description: product.description,
    categoryId: product.category_id,
    category: product.categories.category_name,
    price: product.price,
    unitOfMeasurement: product.unit_of_measurement,
    availableQuantity: product.available_quantity,
    availabilityStatus: product.availability_status,
    villageId: product.village_id,
    generalLocation: product.villages.village_name,
    district: product.villages.cells.sectors.districts.district_name,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    imageUrl: product.product_images[0]?.image_url ?? null,
  };
}

async function listProducts(userId, { search, categoryId, availability, limit, offset }) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return null;
  const where = {
    farmer_id: farmer.id,
    archived_at: null,
    ...(search ? { product_name: { contains: search } } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(availability ? { availability_status: availability } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.products.count({ where }),
    prisma.products.findMany({ where, include: productInclude, orderBy: { created_at: 'desc' }, take: limit, skip: offset }),
  ]);
  return { products: rows.map(mapProduct), total, limit, offset };
}

async function getProduct(userId, productId) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return null;
  const product = await prisma.products.findFirst({
    where: { product_id: Number(productId), farmer_id: farmer.id, archived_at: null },
    include: productInclude,
  });
  return mapProduct(product);
}

async function createProduct(userId, data, imageUrl) {
  const id = await prisma.$transaction(async (tx) => {
    const farmer = await getFarmerId(userId, tx);
    if (!farmer) throw Object.assign(new Error('Farmer profile not found'), { status: 404 });
    const category = await tx.categories.findUnique({ where: { category_id: data.categoryId }, select: { category_id: true } });
    if (!category) throw Object.assign(new Error('Product category not found'), { status: 400 });
    const villageId = data.generalLocation
      ? await findVillage(tx, data.district || '', data.generalLocation)
      : farmer.villageId;
    if (!villageId) throw Object.assign(new Error('Product location must match a configured district and village'), { status: 400 });
    const status = Number(data.quantity) <= 0 ? 'unavailable' : (data.availabilityStatus || 'available');
    const product = await tx.products.create({
      data: {
        farmer_id: farmer.id,
        category_id: data.categoryId,
        village_id: villageId,
        product_name: data.name.trim(),
        description: data.description || null,
        price: data.price,
        unit_of_measurement: data.unit,
        available_quantity: data.quantity,
        availability_status: status,
        ...(imageUrl ? { product_images: { create: { image_url: imageUrl } } } : {}),
      },
      select: { product_id: true },
    });
    return product.product_id;
  }, { isolationLevel: 'Serializable' });
  return getProduct(userId, id);
}

async function updateProduct(userId, productId, data, imageUrl) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return null;
  const exists = await prisma.products.findFirst({
    where: { product_id: Number(productId), farmer_id: farmer.id, archived_at: null },
    select: { product_id: true, available_quantity: true, availability_status: true },
  });
  if (!exists) return null;
  const productData = {};
  for (const [key, field] of Object.entries({ name: 'product_name', description: 'description', price: 'price', unit: 'unit_of_measurement', quantity: 'available_quantity', categoryId: 'category_id' })) {
    if (data[key] !== undefined) productData[field] = key === 'name' || key === 'unit' ? data[key].trim() : data[key];
  }
  if (data.district !== undefined || data.generalLocation !== undefined) {
    if (!data.district || !data.generalLocation) throw Object.assign(new Error('Both district and generalLocation are required to change product location'), { status: 400 });
    const villageId = await findVillage(prisma, data.district, data.generalLocation);
    if (!villageId) throw Object.assign(new Error('Product location must match a configured district and village'), { status: 400 });
    productData.village_id = villageId;
  }
  if (data.categoryId !== undefined && !(await prisma.categories.findUnique({ where: { category_id: data.categoryId }, select: { category_id: true } }))) {
    throw Object.assign(new Error('Product category not found'), { status: 400 });
  }
  const nextQuantity = data.quantity === undefined ? Number(exists.available_quantity) : Number(data.quantity);
  let nextStatus = data.availabilityStatus || exists.availability_status;
  if (nextQuantity <= 0) nextStatus = 'unavailable';
  else if (data.quantity !== undefined && Number(exists.available_quantity) <= 0 && data.availabilityStatus === undefined) nextStatus = 'available';
  if (data.quantity !== undefined && nextQuantity <= 0) productData.available_quantity = 0;
  if (data.availabilityStatus !== undefined || data.quantity !== undefined) productData.availability_status = nextStatus;

  await prisma.$transaction(async (tx) => {
    await tx.products.update({ where: { product_id: Number(productId) }, data: productData });
    if (imageUrl) {
      const image = await tx.product_images.findFirst({ where: { product_id: Number(productId) }, orderBy: { image_id: 'asc' }, select: { image_id: true } });
      if (image) await tx.product_images.update({ where: { image_id: image.image_id }, data: { image_url: imageUrl } });
      else await tx.product_images.create({ data: { product_id: Number(productId), image_url: imageUrl } });
    }
  }, { isolationLevel: 'Serializable' });
  return getProduct(userId, productId);
}

async function updateStock(userId, productId, quantity, price) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return null;
  const result = await prisma.products.updateMany({
    where: { product_id: Number(productId), farmer_id: farmer.id, archived_at: null },
    data: {
      available_quantity: quantity,
      availability_status: Number(quantity) <= 0 ? 'unavailable' : 'available',
      ...(price !== undefined && price !== null ? { price } : {}),
    },
  });
  return result.count ? getProduct(userId, productId) : null;
}

async function archiveProduct(userId, productId) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return false;
  const result = await prisma.products.updateMany({
    where: { product_id: Number(productId), farmer_id: farmer.id, archived_at: null },
    data: { archived_at: new Date(), availability_status: 'unavailable' },
  });
  return result.count > 0;
}

function mapInquiry(inquiry, includeResponses = false) {
  const buyer = inquiry.users;
  const mapped = {
    id: inquiry.inquiry_id,
    productId: inquiry.product_id,
    productName: inquiry.products.product_name,
    buyerId: inquiry.buyer_id,
    buyerName: buyer.full_name,
    buyerEmail: buyer.email,
    buyerPhone: buyer.phone_number,
    requestedQuantity: inquiry.requested_quantity,
    message: inquiry.message,
    status: inquiry.inquiry_status === 'rejected' ? 'declined' : inquiry.inquiry_status,
    submittedAt: inquiry.created_at,
  };
  if (includeResponses) mapped.responses = inquiry.inquiry_responses.map((response) => ({
    id: response.response_id,
    message: response.response_message,
    type: response.response_type === 'rejected' ? 'declined' : response.response_type,
    respondedAt: response.responded_at,
  }));
  return mapped;
}

const inquiryInclude = {
  products: { select: { product_name: true } },
  users: { select: { full_name: true, email: true, phone_number: true } },
};

async function listInquiries(userId, { status, limit, offset }) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return null;
  const where = { products: { farmer_id: farmer.id }, ...(status ? { inquiry_status: status === 'declined' ? 'rejected' : status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.inquiries.count({ where }),
    prisma.inquiries.findMany({ where, include: inquiryInclude, orderBy: { created_at: 'desc' }, take: limit, skip: offset }),
  ]);
  return { inquiries: rows.map((row) => mapInquiry(row)), total, limit, offset };
}

async function getInquiry(userId, inquiryId) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return null;
  const inquiry = await prisma.inquiries.findFirst({
    where: { inquiry_id: Number(inquiryId), products: { farmer_id: farmer.id } },
    include: { ...inquiryInclude, inquiry_responses: { orderBy: { responded_at: 'asc' } } },
  });
  return inquiry ? mapInquiry(inquiry, true) : null;
}

async function respondToInquiry(userId, inquiryId, action, message) {
  const farmer = await getFarmerId(userId);
  if (!farmer) return null;
  await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiries.findFirst({
      where: { inquiry_id: Number(inquiryId), products: { farmer_id: farmer.id } },
      select: { inquiry_status: true },
    });
    if (!inquiry) return;
    if (['accepted', 'rejected', 'closed'].includes(inquiry.inquiry_status) && action !== 'message') {
      throw Object.assign(new Error('This inquiry has already been resolved'), { status: 409 });
    }
    const responseType = action === 'declined' ? 'rejected' : action;
    const responseMessage = message?.trim() || (action === 'accepted' ? 'Inquiry accepted.' : action === 'declined' ? 'Inquiry declined.' : '');
    if (!responseMessage) throw Object.assign(new Error('A response message is required'), { status: 400 });
    await tx.inquiry_responses.create({
      data: { inquiry_id: Number(inquiryId), farmer_id: farmer.id, response_message: responseMessage, response_type: responseType },
    });
    if (action === 'accepted' || action === 'declined') {
      await tx.inquiries.update({ where: { inquiry_id: Number(inquiryId) }, data: { inquiry_status: responseType } });
    }
  }, { isolationLevel: 'Serializable' });
  return getInquiry(userId, inquiryId);
}

module.exports = {
  getProfile, updateProfile, getDashboard, listCategories, getFarmerId, findVillage,
  listProducts, getProduct, createProduct, updateProduct, updateStock, archiveProduct,
  listInquiries, getInquiry, respondToInquiry,
};
