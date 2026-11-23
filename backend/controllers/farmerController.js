const farmerModel = require('../models/farmerModel');
const { saveUploadedImage, removeUploadedImage } = require('../utils/imageStorage');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:\+?2507\d{8}|07\d{8})$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]{1,98}[\p{L}\p{M}]$/u;

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function userIdFromParam(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseDecimal(value, label, required = true) {
  if ((value === undefined || value === null || value === '') && !required) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) {
    throw Object.assign(new Error(`${label} must be a non-negative number with at most 2 decimal places`), { status: 400 });
  }
  if (number > 9999999999.99) throw Object.assign(new Error(`${label} exceeds the supported range`), { status: 400 });
  return number;
}

function validateProduct(body, partial = false) {
  const data = {};
  const fields = [
    ['name', 'productName', (value) => typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 150],
    ['description', 'description', (value) => typeof value === 'string' && value.length <= 5000],
    ['unit', 'unitOfMeasurement', (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 50],
    ['district', 'district', (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 100],
    ['generalLocation', 'generalLocation', (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 100],
  ];
  for (const [target, source, valid] of fields) {
    if (body[source] === undefined && partial) continue;
    const value = body[source] ?? (source === 'description' && !partial ? '' : undefined);
    if (!valid(value)) {
      throw Object.assign(new Error(`${source} is invalid or required`), { status: 400 });
    }
    data[target] = value.trim();
  }
  if (body.categoryId !== undefined || !partial) {
    const categoryId = Number(body.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) throw Object.assign(new Error('categoryId must be a positive integer'), { status: 400 });
    data.categoryId = categoryId;
  }
  if (body.price !== undefined || !partial) data.price = parseDecimal(body.price, 'price');
  if (body.quantity !== undefined || !partial) data.quantity = parseDecimal(body.quantity, 'quantity');
  if (body.availabilityStatus !== undefined) {
    const status = String(body.availabilityStatus).toLowerCase();
    if (!['available', 'unavailable'].includes(status)) throw Object.assign(new Error('availabilityStatus must be available or unavailable'), { status: 400 });
    data.availabilityStatus = status;
  }
  if (data.price !== undefined && data.price <= 0) throw Object.assign(new Error('price must be greater than zero'), { status: 400 });
  return data;
}

const dashboard = asyncHandler(async (req, res) => {
  const data = await farmerModel.getDashboard(req.user.id);
  if (!data) return res.status(404).json({ success: false, message: 'Farmer profile not found' });
  return res.json({ success: true, data });
});

const getProfile = asyncHandler(async (req, res) => {
  const profile = await farmerModel.getProfile(req.user.id);
  if (!profile) return res.status(404).json({ success: false, message: 'Farmer profile not found' });
  return res.json({ success: true, data: { profile } });
});

const createProfile = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (typeof body.district !== 'string' || !body.district.trim() || body.district.trim().length > 100
      || typeof body.generalLocation !== 'string' || !body.generalLocation.trim() || body.generalLocation.trim().length > 100) {
    return res.status(400).json({ success: false, message: 'district and generalLocation are required and must be at most 100 characters' });
  }
  if (body.farmDescription !== undefined && (typeof body.farmDescription !== 'string' || body.farmDescription.length > 5000)) {
    return res.status(400).json({ success: false, message: 'farmDescription must be a string of at most 5000 characters' });
  }
  try {
    const profile = await farmerModel.createProfile(req.user.id, {
      district: body.district.trim(),
      generalLocation: body.generalLocation.trim(),
      farmDescription: body.farmDescription?.trim(),
    });
    return res.status(201).json({ success: true, message: 'Farmer profile created successfully', data: { profile } });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Farmer profile already exists' });
    throw error;
  }
});

const updateProfile = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const data = {};
  if (body.fullName !== undefined) {
    if (typeof body.fullName !== 'string' || !NAME_PATTERN.test(body.fullName.trim())) return res.status(400).json({ success: false, message: 'Full name is invalid' });
    data.fullName = body.fullName.trim();
  }
  if (body.email !== undefined) {
    if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim()) || body.email.length > 150) return res.status(400).json({ success: false, message: 'A valid email address is required' });
    data.email = body.email.trim().toLowerCase();
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || !PHONE_PATTERN.test(body.phone.replace(/[\s()-]/g, ''))) return res.status(400).json({ success: false, message: 'Enter a valid Rwanda phone number' });
    const phone = body.phone.replace(/[\s()-]/g, '');
    data.phone = phone.startsWith('07') ? `+250${phone.slice(1)}` : (phone.startsWith('250') ? `+${phone}` : phone);
  }
  if (body.district !== undefined) data.district = typeof body.district === 'string' ? body.district.trim() : '';
  if (body.generalLocation !== undefined) data.generalLocation = typeof body.generalLocation === 'string' ? body.generalLocation.trim() : '';
  if (body.farmDescription !== undefined) {
    if (typeof body.farmDescription !== 'string' || body.farmDescription.length > 5000) return res.status(400).json({ success: false, message: 'Farm description must be at most 5000 characters' });
    data.farmDescription = body.farmDescription.trim();
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ success: false, message: 'Provide at least one profile field to update' });
  try {
    const profile = await farmerModel.updateProfile(req.user.id, data);
    if (!profile) return res.status(404).json({ success: false, message: 'Farmer profile not found' });
    return res.json({ success: true, message: 'Profile updated successfully', data: { profile } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'P2002') return res.status(409).json({ success: false, message: 'Email or phone is already in use' });
    throw error;
  }
});

const updateProfilePicture = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Select an image file in the image field' });
  const previous = await farmerModel.getProfile(req.user.id);
  if (!previous) return res.status(404).json({ success: false, message: 'Farmer profile not found' });
  const url = await saveUploadedImage(req.file, 'profiles');
  try {
    const profile = await farmerModel.updateProfile(req.user.id, { profilePictureUrl: url });
    await removeUploadedImage(previous.profilePictureUrl);
    return res.json({ success: true, message: 'Profile picture updated', data: { profile } });
  } catch (error) {
    await removeUploadedImage(url);
    throw error;
  }
});

const categories = asyncHandler(async (req, res) => {
  return res.json({ success: true, data: { categories: await farmerModel.listCategories() } });
});

const listProducts = asyncHandler(async (req, res) => {
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const availability = req.query.availability ? String(req.query.availability).toLowerCase() : null;
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) return res.status(400).json({ success: false, message: 'categoryId must be a positive integer' });
  if (availability && !['available', 'unavailable'].includes(availability)) return res.status(400).json({ success: false, message: 'availability must be available or unavailable' });
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const result = await farmerModel.listProducts(req.user.id, { search: typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 150) : null, categoryId, availability, limit, offset });
  if (!result) return res.status(404).json({ success: false, message: 'Farmer profile not found' });
  return res.json({ success: true, data: result });
});

const getProduct = asyncHandler(async (req, res) => {
  const id = userIdFromParam(req.params.productId);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid product ID' });
  const product = await farmerModel.getProduct(req.user.id, id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  return res.json({ success: true, data: { product } });
});

const createProduct = asyncHandler(async (req, res) => {
  const data = validateProduct(req.body || {});
  const imageUrl = await saveUploadedImage(req.file, 'products');
  try {
    const product = await farmerModel.createProduct(req.user.id, data, imageUrl);
    return res.status(201).json({ success: true, message: 'Product created successfully', data: { product } });
  } catch (error) {
    await removeUploadedImage(imageUrl);
    throw error;
  }
});

const createProducts = asyncHandler(async (req, res) => {
  const products = req.body?.products;
  if (!Array.isArray(products) || products.length < 1 || products.length > 50) {
    return res.status(400).json({ success: false, message: 'products must be an array containing 1 to 50 products' });
  }
  const validated = products.map((product, index) => {
    try {
      return validateProduct(product || {});
    } catch (error) {
      throw Object.assign(new Error(`products[${index}]: ${error.message}`), { status: 400 });
    }
  });
  const created = await farmerModel.createProducts(req.user.id, validated);
  return res.status(201).json({
    success: true,
    message: `${created.length} products created successfully`,
    data: { products: created, total: created.length },
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const id = userIdFromParam(req.params.productId);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid product ID' });
  const data = validateProduct(req.body || {}, true);
  if (Object.keys(data).length === 0 && !req.file) return res.status(400).json({ success: false, message: 'Provide at least one product field or an image to update' });
  const previous = req.file ? await farmerModel.getProduct(req.user.id, id) : null;
  if (req.file && !previous) return res.status(404).json({ success: false, message: 'Product not found' });
  const imageUrl = await saveUploadedImage(req.file, 'products');
  try {
    const product = await farmerModel.updateProduct(req.user.id, id, data, imageUrl);
    if (!product) { await removeUploadedImage(imageUrl); return res.status(404).json({ success: false, message: 'Product not found' }); }
    if (imageUrl) await removeUploadedImage(previous.imageUrl);
    return res.json({ success: true, message: 'Product updated successfully', data: { product } });
  } catch (error) {
    await removeUploadedImage(imageUrl);
    throw error;
  }
});

const updateStock = asyncHandler(async (req, res) => {
  const id = userIdFromParam(req.params.productId);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid product ID' });
  const quantity = parseDecimal(req.body?.quantity, 'quantity');
  const price = parseDecimal(req.body?.price, 'price', false);
  if (price !== undefined && price <= 0) return res.status(400).json({ success: false, message: 'price must be greater than zero' });
  const product = await farmerModel.updateStock(req.user.id, id, quantity, price);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  return res.json({ success: true, message: 'Stock updated successfully', data: { product } });
});

const archiveProduct = asyncHandler(async (req, res) => {
  const id = userIdFromParam(req.params.productId);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid product ID' });
  const archived = await farmerModel.archiveProduct(req.user.id, id);
  if (!archived) return res.status(404).json({ success: false, message: 'Product not found' });
  return res.json({ success: true, message: 'Product archived and removed from your active listings' });
});

const listInquiries = asyncHandler(async (req, res) => {
  const requestedStatus = req.query.status ? String(req.query.status).toLowerCase() : null;
  const statuses = { pending: 'pending', accepted: 'accepted', declined: 'rejected', rejected: 'rejected', closed: 'closed' };
  if (requestedStatus && !statuses[requestedStatus]) return res.status(400).json({ success: false, message: 'status must be pending, accepted, declined, or closed' });
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const result = await farmerModel.listInquiries(req.user.id, { status: requestedStatus ? statuses[requestedStatus] : null, limit, offset });
  if (!result) return res.status(404).json({ success: false, message: 'Farmer profile not found' });
  return res.json({ success: true, data: result });
});

const getInquiry = asyncHandler(async (req, res) => {
  const id = userIdFromParam(req.params.inquiryId);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid inquiry ID' });
  const inquiry = await farmerModel.getInquiry(req.user.id, id);
  if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found' });
  return res.json({ success: true, data: { inquiry } });
});

const respondToInquiry = asyncHandler(async (req, res) => {
  const id = userIdFromParam(req.params.inquiryId);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid inquiry ID' });
  const action = typeof req.body?.action === 'string' ? req.body.action.toLowerCase() : '';
  if (!['accepted', 'declined', 'message'].includes(action)) return res.status(400).json({ success: false, message: 'action must be accepted, declined, or message' });
  if (req.body.message !== undefined && (typeof req.body.message !== 'string' || req.body.message.length > 5000)) return res.status(400).json({ success: false, message: 'message must be at most 5000 characters' });
  const inquiry = await farmerModel.respondToInquiry(req.user.id, id, action, req.body.message);
  if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found' });
  return res.json({ success: true, message: 'Inquiry response saved', data: { inquiry } });
});

module.exports = {
  dashboard, getProfile, createProfile, updateProfile, updateProfilePicture, categories,
  listProducts, getProduct, createProduct, createProducts, updateProduct, updateStock, archiveProduct,
  listInquiries, getInquiry, respondToInquiry,
};
