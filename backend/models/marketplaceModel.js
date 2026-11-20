const prisma = require('../config/prisma');

const productInclude = {
  categories: { select: { category_name: true } },
  product_images: { select: { image_url: true }, orderBy: { image_id: 'asc' }, take: 1 },
  villages: {
    select: {
      village_name: true,
      cells: { select: { sectors: { select: { districts: { select: { district_name: true } } } } } },
    },
  },
  farmer_profiles: {
    select: {
      user_id: true,
      users: { select: { full_name: true, email: true, phone_number: true, account_status: true } },
    },
  },
};

function mapProduct(product) {
  const farmer = product.farmer_profiles.users;
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
    createdAt: product.created_at,
    generalLocation: product.villages.village_name,
    district: product.villages.cells.sectors.districts.district_name,
    farmerUserId: product.farmer_profiles.user_id,
    farmerName: farmer.full_name,
    farmerEmail: farmer.email,
    farmerPhone: farmer.phone_number,
    imageUrl: product.product_images[0]?.image_url ?? null,
  };
}

function publicProductWhere({ search, categoryId, district }) {
  return {
    archived_at: null,
    availability_status: 'available',
    available_quantity: { gt: 0 },
    farmer_profiles: { users: { account_status: 'active' } },
    ...(search ? { product_name: { contains: search } } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(district ? { villages: { cells: { sectors: { districts: { district_name: district } } } } } : {}),
  };
}

async function listProducts({ search, categoryId, district, limit, offset }) {
  const where = publicProductWhere({ search, categoryId, district });
  const [total, rows] = await Promise.all([
    prisma.products.count({ where }),
    prisma.products.findMany({
      where,
      include: productInclude,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);
  return { products: rows.map(mapProduct), total, limit, offset };
}

async function getProduct(productId) {
  const product = await prisma.products.findFirst({
    where: { product_id: Number(productId), ...publicProductWhere({}) },
    include: productInclude,
  });
  return product ? mapProduct(product) : null;
}

async function createInquiry(buyerId, productId, quantity, message) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.products.findFirst({
      where: { product_id: Number(productId), archived_at: null, availability_status: 'available' },
      select: { product_id: true, available_quantity: true },
    });
    if (!product) return { error: 'Product is not available', status: 404 };
    if (Number(quantity) > Number(product.available_quantity)) {
      return { error: 'Requested quantity exceeds current available stock', status: 409 };
    }
    const inquiry = await tx.inquiries.create({
      data: { product_id: product.product_id, buyer_id: Number(buyerId), requested_quantity: quantity, message: message || null },
      select: { inquiry_id: true },
    });
    return { id: inquiry.inquiry_id };
  }, { isolationLevel: 'Serializable' });
}

function mapBuyerInquiry(inquiry) {
  const product = inquiry.products;
  const farmer = product.farmer_profiles.users;
  return {
    id: inquiry.inquiry_id,
    productId: inquiry.product_id,
    productName: product.product_name,
    requestedQuantity: inquiry.requested_quantity,
    message: inquiry.message,
    status: inquiry.inquiry_status === 'rejected' ? 'declined' : inquiry.inquiry_status,
    submittedAt: inquiry.created_at,
    farmerName: farmer.full_name,
  };
}

async function listBuyerInquiries(buyerId, { status, limit, offset }) {
  const where = { buyer_id: Number(buyerId), ...(status ? { inquiry_status: status === 'declined' ? 'rejected' : status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.inquiries.count({ where }),
    prisma.inquiries.findMany({
      where,
      include: { products: { select: { product_name: true, farmer_profiles: { select: { users: { select: { full_name: true } } } } } } },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);
  return { inquiries: rows.map(mapBuyerInquiry), total, limit, offset };
}

async function getBuyerInquiry(buyerId, inquiryId) {
  const inquiry = await prisma.inquiries.findFirst({
    where: { inquiry_id: Number(inquiryId), buyer_id: Number(buyerId) },
    include: {
      products: { select: { product_name: true, farmer_profiles: { select: { users: { select: { full_name: true } } } } } },
      inquiry_responses: { orderBy: { responded_at: 'asc' } },
    },
  });
  if (!inquiry) return null;
  return {
    ...mapBuyerInquiry(inquiry),
    responses: inquiry.inquiry_responses.map((response) => ({
      id: response.response_id,
      message: response.response_message,
      type: response.response_type === 'rejected' ? 'declined' : response.response_type,
      respondedAt: response.responded_at,
    })),
  };
}

module.exports = { listProducts, getProduct, createInquiry, listBuyerInquiries, getBuyerInquiry };
