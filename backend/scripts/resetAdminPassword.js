require('../config/env').validateEnvironment();
const { pool } = require('../config/legacyDatabase');
const { hashPassword, isStrongPassword } = require('../utils/password');

(async () => {
  try {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !isStrongPassword(password)) {
      throw new Error('Set ADMIN_EMAIL and a strong ADMIN_PASSWORD in the local .env file');
    }

    const [admins] = await pool.execute(
      `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE LOWER(u.email) = ? AND UPPER(r.role_name) = 'ADMIN' LIMIT 1`, [email]);
    if (!admins.length) throw new Error('No administrator account exists with ADMIN_EMAIL');

    await pool.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?',
      [await hashPassword(password), admins[0].user_id]);
    console.log('Administrator password updated. Existing tokens for that account have been invalidated.');
  } catch (error) {
    console.error('Administrator password reset failed:', error.code || error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
