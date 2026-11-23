const prisma = require('../config/prisma');

function toPublicUser(user) {
  if (!user) return null;
  const village = user.farmer_profiles?.villages;
  return {
    id: user.user_id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone_number,
    role: user.roles.role_name.toUpperCase(),
    status: user.account_status.toUpperCase(),
    tokenVersion: user.token_version,
    mustChangePassword: user.must_change_password,
    ...(village ? {
      district: village.cells.sectors.districts.district_name,
      generalLocation: village.village_name,
    } : {}),
  };
}

const publicUserInclude = {
  roles: { select: { role_name: true } },
  farmer_profiles: {
    select: {
      villages: {
        select: {
          village_name: true,
          cells: { select: { sectors: { select: { districts: { select: { district_name: true } } } } } },
        },
      },
    },
  },
};

async function findByEmail(email) {
  const user = await prisma.users.findFirst({
    where: { email: { equals: email } },
    select: {
      user_id: true,
      full_name: true,
      email: true,
      phone_number: true,
      password_hash: true,
      account_status: true,
      token_version: true,
      must_change_password: true,
      roles: { select: { role_name: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.user_id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone_number,
    passwordHash: user.password_hash,
    role: user.roles.role_name.toUpperCase(),
    status: user.account_status.toUpperCase(),
    tokenVersion: user.token_version,
    mustChangePassword: user.must_change_password,
  };
}

async function findPublicById(id) {
  const user = await prisma.users.findUnique({ where: { user_id: Number(id) }, include: publicUserInclude });
  return toPublicUser(user);
}

async function findByIdWithPassword(id) {
  const user = await prisma.users.findUnique({
    where: { user_id: Number(id) },
    select: { user_id: true, email: true, password_hash: true },
  });
  return user ? { id: user.user_id, email: user.email, passwordHash: user.password_hash } : null;
}

async function updateProfile(id, data) {
  const userId = Number(id);
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.users.findUnique({
      where: { user_id: userId },
      select: { user_id: true, roles: { select: { role_name: true } } },
    });
    if (!existing) return false;

    const userData = {};
    if (data.fullName !== undefined) userData.full_name = data.fullName;
    if (data.email !== undefined) userData.email = data.email;
    if (data.phone !== undefined) userData.phone_number = data.phone;
    if (Object.keys(userData).length) await tx.users.update({ where: { user_id: userId }, data: userData });

    if (data.phone !== undefined && existing.roles.role_name === 'buyer') {
      await tx.buyer_profiles.updateMany({ where: { user_id: userId }, data: { telephone_number: data.phone } });
    }
    return true;
  });
  return updated ? findPublicById(userId) : null;
}

async function create({ fullName, email, phone, passwordHash, role, district, generalLocation, mustChangePassword = true }) {
  const userId = await prisma.$transaction(async (tx) => {
    const roleRow = await tx.roles.findFirst({ where: { role_name: role.toLowerCase() }, select: { role_id: true } });
    if (!roleRow) throw Object.assign(new Error(`Role ${role} is not configured`), { status: 500 });

    let villageId;
    if (role === 'FARMER') {
      const village = await tx.villages.findFirst({
        where: {
          village_name: generalLocation,
          cells: { sectors: { districts: { district_name: district } } },
        },
        select: { village_id: true },
      });
      if (!village) {
        throw Object.assign(new Error('The supplied district and location must match a configured village'), { status: 400 });
      }
      villageId = village.village_id;
    }

    const user = await tx.users.create({
      data: {
        role_id: roleRow.role_id,
        full_name: fullName,
        email,
        phone_number: phone,
        password_hash: passwordHash,
        account_status: 'active',
        must_change_password: mustChangePassword,
        ...(role === 'FARMER' ? { farmer_profiles: { create: { village_id: villageId } } } : {}),
        ...(role === 'BUYER' ? { buyer_profiles: { create: { telephone_number: phone } } } : {}),
      },
      select: { user_id: true },
    });
    return user.user_id;
  });
  return findPublicById(userId);
}

async function changePassword(id, passwordHash) {
  await prisma.users.update({
    where: { user_id: Number(id) },
    data: {
      password_hash: passwordHash,
      token_version: { increment: 1 },
      must_change_password: false,
    },
  });
}

module.exports = { findByEmail, findPublicById, findByIdWithPassword, updateProfile, create, changePassword };
