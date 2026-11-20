const prisma = require('../config/prisma');

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseUserId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapUser(user) {
  const village = user.farmer_profiles?.villages;
  return {
    id: user.user_id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone_number,
    role: user.roles.role_name.toUpperCase(),
    status: user.account_status.toUpperCase(),
    createdAt: user.created_at,
    ...(village ? {
      district: village.cells.sectors.districts.district_name,
      generalLocation: village.village_name,
    } : {}),
  };
}

const userInclude = {
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

const listUsers = asyncHandler(async (req, res) => {
  const status = req.query.status?.toLowerCase();
  const role = req.query.role?.toUpperCase();
  if (status && !['active', 'suspended', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be active, suspended, or inactive' });
  }
  if (role && !['FARMER', 'BUYER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ success: false, message: 'role must be FARMER, BUYER, or ADMIN' });
  }
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const users = await prisma.users.findMany({
    where: {
      ...(status ? { account_status: status } : {}),
      ...(role ? { roles: { role_name: role.toLowerCase() } } : {}),
    },
    include: userInclude,
    orderBy: { user_id: 'desc' },
    take: limit,
    skip: offset,
  });
  return res.json({ success: true, data: { users: users.map(mapUser), pagination: { limit, offset } } });
});

const updateStatus = asyncHandler(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const nextStatus = typeof req.body?.status === 'string' ? req.body.status.toLowerCase() : '';
  if (!userId) return res.status(400).json({ success: false, message: 'A valid user ID is required' });
  if (!['active', 'suspended', 'inactive'].includes(nextStatus)) {
    return res.status(400).json({ success: false, message: 'status must be active, suspended, or inactive' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.users.findUnique({
      where: { user_id: userId },
      select: { user_id: true, account_status: true, roles: { select: { role_name: true } } },
    });
    if (!target) return { statusCode: 404, body: { success: false, message: 'Account not found' } };
    const role = target.roles.role_name.toUpperCase();
    const currentStatus = target.account_status;
    if (String(req.user.id) === String(userId) && nextStatus !== 'active') {
      return { statusCode: 409, body: { success: false, message: 'You cannot deactivate your own admin account' } };
    }
    if (role === 'ADMIN' && currentStatus === 'active' && nextStatus !== 'active') {
      const activeAdmins = await tx.users.count({
        where: { account_status: 'active', roles: { role_name: 'admin' } },
      });
      if (activeAdmins <= 1) {
        return { statusCode: 409, body: { success: false, message: 'The last active administrator cannot be deactivated' } };
      }
    }
    if (currentStatus === nextStatus) {
      return { statusCode: 200, body: { success: true, message: 'Account already has that status', data: { userId, status: nextStatus.toUpperCase() } } };
    }

    await tx.users.update({
      where: { user_id: userId },
      data: { account_status: nextStatus, token_version: { increment: 1 } },
    });
    const actionType = nextStatus === 'active'
      ? (currentStatus === 'inactive' ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_ACTIVATED')
      : (nextStatus === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_DEACTIVATED');
    await tx.moderation_actions.create({
      data: {
        action_type: actionType,
        reason: typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 2000) : null,
        users_moderation_actions_admin_idTousers: { connect: { user_id: Number(req.user.id) } },
        users_moderation_actions_user_idTousers: { connect: { user_id: userId } },
      },
    });
    return { statusCode: 200, body: { success: true, message: 'Account status updated', data: { userId, status: nextStatus.toUpperCase() } } };
  }, { isolationLevel: 'Serializable' });
  return res.status(result.statusCode).json(result.body);
});

const deleteUser = asyncHandler(async (req, res) => {
  const userId = parseUserId(req.params.userId);
  if (!userId) return res.status(400).json({ success: false, message: 'A valid user ID is required' });
  if (String(req.user.id) === String(userId)) {
    return res.status(409).json({ success: false, message: 'You cannot delete your own admin account' });
  }
  if (typeof req.body?.confirmEmail !== 'string' || !req.body.confirmEmail.trim()) {
    return res.status(400).json({ success: false, message: 'confirmEmail is required to permanently delete an account' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.users.findUnique({
      where: { user_id: userId },
      select: { user_id: true, email: true, account_status: true, roles: { select: { role_name: true } } },
    });
    if (!target) return { statusCode: 404, body: { success: false, message: 'Account not found' } };
    if (target.email.toLowerCase() !== req.body.confirmEmail.trim().toLowerCase()) {
      return { statusCode: 400, body: { success: false, message: 'confirmEmail does not match the account email' } };
    }
    if (target.roles.role_name === 'admin' && target.account_status === 'active') {
      const activeAdmins = await tx.users.count({ where: { account_status: 'active', roles: { role_name: 'admin' } } });
      if (activeAdmins <= 1) {
        return { statusCode: 409, body: { success: false, message: 'The last active administrator cannot be deleted' } };
      }
    }

    const [profile, inquiries, reports, auditAsAdmin, auditAsTarget] = await Promise.all([
      tx.farmer_profiles.findUnique({
        where: { user_id: userId },
        select: { farmer_id: true, products: { select: { product_id: true }, take: 1 }, inquiry_responses: { select: { response_id: true }, take: 1 } },
      }),
      tx.inquiries.findFirst({ where: { buyer_id: userId }, select: { inquiry_id: true } }),
      tx.listing_reports.findFirst({ where: { reporter_id: userId }, select: { report_id: true } }),
      tx.moderation_actions.findFirst({ where: { admin_id: userId }, select: { action_id: true } }),
      tx.moderation_actions.findFirst({ where: { user_id: userId }, select: { action_id: true } }),
    ]);
    if (profile?.products.length || profile?.inquiry_responses.length || inquiries || reports || auditAsAdmin || auditAsTarget) {
      return { statusCode: 409, body: {
        success: false,
        message: 'Account has linked marketplace or audit records. Deactivate it instead to preserve history.',
      } };
    }
    await tx.users.delete({ where: { user_id: userId } });
    return { statusCode: 200, body: { success: true, message: 'Account permanently deleted', data: { userId } } };
  }, { isolationLevel: 'Serializable' });
  return res.status(result.statusCode).json(result.body);
});

module.exports = { listUsers, updateStatus, deleteUser };
