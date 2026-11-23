const userModel = require('../models/userModel');
const { isStrongPassword, hashPassword, comparePassword, generateTemporaryPassword } = require('../utils/password');
const { signToken, tokenIdHash } = require('../utils/token');
const prisma = require('../config/prisma');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:\+?2507\d{8}|07\d{8})$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]{1,98}[\p{L}\p{M}]$/u;

function validateRegistration(body, role, allowRoleSelection = false) {
  const errors = [];
  const { fullName, email, phone, password, confirmPassword, district, generalLocation } = body;
  if (!allowRoleSelection && ['role', 'userType', 'accountType'].some((field) => body[field] !== undefined)) {
    errors.push('Role cannot be set on this registration endpoint');
  }
  if (typeof fullName !== 'string' || !NAME_PATTERN.test(fullName.trim())) errors.push('Full name is required and must contain valid name characters');
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()) || email.length > 254) errors.push('A valid email address is required');
  if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.replace(/[\s()-]/g, ''))) errors.push('Enter a valid Rwanda phone number');
  const generatedPassword = password === undefined || password === null || password === '';
  if (!generatedPassword && !isStrongPassword(password)) errors.push('Password must be 12–72 characters and include uppercase, lowercase, number, and symbol');
  if (generatedPassword && confirmPassword !== undefined) errors.push('Omit confirmation when a temporary password is generated');
  if (!generatedPassword && password !== confirmPassword) errors.push('Password confirmation does not match');
  if (role === 'FARMER') {
    if (typeof district !== 'string' || !district.trim()) errors.push('District is required for farmer registration');
    if (typeof generalLocation !== 'string' || !generalLocation.trim()) errors.push('General location is required for farmer registration');
  }
  return errors;
}

function normalizePhone(phone) {
  const compact = phone.replace(/[\s()-]/g, '');
  return compact.startsWith('07') ? `+250${compact.slice(1)}` : (compact.startsWith('250') ? `+${compact}` : compact);
}

function publicUser(user) {
  return { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role,
    ...(user.district ? { district: user.district } : {}),
    ...(user.generalLocation ? { generalLocation: user.generalLocation } : {}) };
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function createAccount(req, res, role, allowRoleSelection = false) {
    const errors = validateRegistration(req.body || {}, role, allowRoleSelection);
    if (errors.length) return res.status(400).json({ success: false, message: 'Registration validation failed', errors });

    const email = req.body.email.trim().toLowerCase();
    const phone = normalizePhone(req.body.phone);
    const generatedPassword = req.body.password === undefined || req.body.password === null || req.body.password === '';
    const initialPassword = generatedPassword ? generateTemporaryPassword() : req.body.password;
    const passwordHash = await hashPassword(initialPassword);
    try {
      const user = await userModel.create({
        fullName: req.body.fullName.trim(), email, phone, passwordHash, role,
        district: role === 'FARMER' ? req.body.district.trim() : null,
        generalLocation: role === 'FARMER' ? req.body.generalLocation.trim() : null,
        mustChangePassword: true,
      });
      const data = { user: publicUser(user), mustChangePassword: true };
      if (generatedPassword) data.credentials = { email, temporaryPassword: initialPassword };
      return res.status(201).json({ success: true, message: 'Account created. The user must change the temporary password at first login.', data });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'P2002') {
        const field = String(error.message).includes('phone') ? 'Phone number' : 'Email address';
        return res.status(409).json({ success: false, message: `${field} is already registered` });
      }
      throw error;
    }
}

function register(role) {
  return asyncHandler((req, res) => createAccount(req, res, role));
}

const registerSelectedRole = asyncHandler((req, res) => {
  const body = req.body || {};
  const roleValues = [body.role, body.userType, body.accountType].filter((value) => value !== undefined);
  const selectedRole = roleValues.length ? String(roleValues[0]).trim().toUpperCase() : '';
  if (!selectedRole || !['FARMER', 'BUYER'].includes(selectedRole)
      || roleValues.some((value) => String(value).trim().toUpperCase() !== selectedRole)) {
    return res.status(400).json({ success: false, message: 'role must be FARMER or BUYER' });
  }
  return createAccount(req, res, selectedRole, true);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()) || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, message: 'A valid email address and password are required' });
  }
  const user = await userModel.findByEmail(email.trim().toLowerCase());
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  if (user.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'Account is suspended' });
  return res.json({ success: true, message: 'Login successful', data: {
    user: publicUser(user), token: signToken(user), mustChangePassword: Boolean(user.mustChangePassword),
  } });
});

const logout = asyncHandler(async (req, res) => {
  const { jti, exp } = req.auth.claims;
  await prisma.$transaction([
    prisma.revoked_tokens.deleteMany({ where: { expires_at: { lte: new Date() } } }),
    prisma.revoked_tokens.upsert({
      where: { jti_hash: tokenIdHash(jti) },
      create: { jti_hash: tokenIdHash(jti), user_id: req.user.id, expires_at: new Date(exp * 1000) },
      update: {},
    }),
  ]);
  return res.json({ success: true, message: 'Logout successful' });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ success: false, message: 'Current password is required' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'New password must be 12–72 characters and include uppercase, lowercase, number, and symbol' });
  }
  if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Password confirmation does not match' });
  const user = await userModel.findByIdWithPassword(req.user.id);
  if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }
  await userModel.changePassword(req.user.id, await hashPassword(newPassword));
  return res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findPublicById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({ success: true, data: { user: publicUser(user) } });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const allowedFields = new Set(['fullName', 'email', 'phone']);
  const suppliedFields = Object.keys(body);
  if (suppliedFields.some((field) => !allowedFields.has(field))) {
    return res.status(400).json({ success: false, message: 'Only fullName, email, and phone can be updated here' });
  }
  const data = {};
  if (body.fullName !== undefined) {
    if (typeof body.fullName !== 'string' || !NAME_PATTERN.test(body.fullName.trim())) {
      return res.status(400).json({ success: false, message: 'Full name is invalid' });
    }
    data.fullName = body.fullName.trim();
  }
  if (body.email !== undefined) {
    if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim()) || body.email.trim().length > 150) {
      return res.status(400).json({ success: false, message: 'A valid email address of at most 150 characters is required' });
    }
    data.email = body.email.trim().toLowerCase();
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || !PHONE_PATTERN.test(body.phone.replace(/[\s()-]/g, ''))) {
      return res.status(400).json({ success: false, message: 'Enter a valid Rwanda phone number' });
    }
    const compact = body.phone.replace(/[\s()-]/g, '');
    data.phone = compact.startsWith('07') ? `+250${compact.slice(1)}` : (compact.startsWith('250') ? `+${compact}` : compact);
  }
  if (!Object.keys(data).length) {
    return res.status(400).json({ success: false, message: 'Provide at least one profile field to update' });
  }
  try {
    const user = await userModel.updateProfile(req.user.id, data);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, message: 'Profile updated successfully', data: { user: publicUser(user) } });
  } catch (error) {
    if (error.code === 'P2002' || error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email or phone is already in use' });
    }
    throw error;
  }
});

const getAccountById = asyncHandler(async (req, res) => {
  const id = Number(req.params.userId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: 'A valid user ID is required' });
  }
  const user = await userModel.findPublicById(id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({ success: true, data: { user: publicUser(user) } });
});

module.exports = {
  register: registerSelectedRole,
  registerFarmer: register('FARMER'),
  registerBuyer: register('BUYER'),
  login,
  logout,
  changePassword,
  me,
  updateMyProfile,
  getAccountById,
};
