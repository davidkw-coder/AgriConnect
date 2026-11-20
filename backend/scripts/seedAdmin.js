require('../config/env').validateEnvironment();
const { pool } = require('../config/legacyDatabase');
const { hashPassword, isStrongPassword } = require('../utils/password');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:\+?2507\d{8}|07\d{8})$/;

(async () => {
  try {
    const { ADMIN_FULL_NAME: fullName, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD } = process.env;
    const email = (ADMIN_EMAIL || '').trim().toLowerCase();
    const phone = (ADMIN_PHONE || '').trim();
    if (!fullName || !EMAIL_PATTERN.test(email) || !PHONE_PATTERN.test(phone) || !isStrongPassword(ADMIN_PASSWORD)) {
      throw new Error('Set ADMIN_FULL_NAME, valid ADMIN_EMAIL and ADMIN_PHONE, and a strong ADMIN_PASSWORD in .env');
    }
    const [admins] = await pool.execute(
      `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE UPPER(r.role_name) = 'ADMIN' LIMIT 1`);
    if (admins.length) throw new Error('An administrator account already exists; refusing to create another');
    const [existing] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ? OR phone_number = ? LIMIT 1', [email, phone]);
    if (existing.length) throw new Error('An account already uses this administrator email or phone');
    const normalizedPhone = phone.startsWith('07') ? `+250${phone.slice(1)}` : (phone.startsWith('250') ? `+${phone}` : phone);
    const [role] = await pool.execute("SELECT role_id FROM roles WHERE UPPER(role_name) = 'ADMIN' LIMIT 1");
    if (!role.length) throw new Error('ADMIN role is missing from the roles table');
    await pool.execute(
      `INSERT INTO users (role_id, full_name, email, phone_number, password_hash, account_status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [role[0].role_id, fullName.trim(), email, normalizedPhone, await hashPassword(ADMIN_PASSWORD)]);
    console.log(`Administrator account provisioned for ${email}.`);
  } catch (error) {
    console.error('Administrator provisioning failed:', error.code || error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
