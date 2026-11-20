const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { tokenIdHash } = require('../utils/token');

async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    const claims = jwt.verify(match[1], process.env.JWT_SECRET);
    if (!claims.sub || !claims.jti) throw new Error('Invalid token');
    const revoked = await prisma.revoked_tokens.findFirst({
      where: { jti_hash: tokenIdHash(claims.jti), expires_at: { gt: new Date() } },
      select: { jti_hash: true },
    });
    if (revoked) return res.status(401).json({ success: false, message: 'Token is no longer valid' });

    const user = await prisma.users.findUnique({
      where: { user_id: Number(claims.sub) },
      select: {
        user_id: true,
        token_version: true,
        account_status: true,
        must_change_password: true,
        roles: { select: { role_name: true } },
      },
    });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    if (user.account_status !== 'active') return res.status(403).json({ success: false, message: 'Account is suspended' });
    if (claims.ver !== user.token_version) return res.status(401).json({ success: false, message: 'Token is no longer valid' });
    if (user.must_change_password && !(req.method === 'PUT' && req.path === '/change-password')) {
      return res.status(403).json({ success: false, message: 'Change your temporary password before using this account' });
    }
    req.user = { id: user.user_id, role: user.roles.role_name.toUpperCase(), mustChangePassword: user.must_change_password };
    req.auth = { token: match[1], claims };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired authentication token' });
    }
    return next(error);
  }
}

module.exports = authenticate;
