require('../config/env').validateEnvironment();
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/legacyDatabase');

(async () => {
  try {
    const [tokenVersionColumn] = await pool.query("SHOW COLUMNS FROM users LIKE 'token_version'");
    if (!tokenVersionColumn.length) {
      await pool.query('ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER account_status');
      console.log('Added users.token_version for revoking older sessions after password changes.');
    }
    const [temporaryPasswordColumn] = await pool.query("SHOW COLUMNS FROM users LIKE 'must_change_password'");
    if (!temporaryPasswordColumn.length) {
      await pool.query('ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER token_version');
      console.log('Added users.must_change_password for first-login password changes.');
    }
    const [profilePictureColumn] = await pool.query("SHOW COLUMNS FROM users LIKE 'profile_picture_url'");
    if (!profilePictureColumn.length) {
      await pool.query('ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500) NULL AFTER phone_number');
      console.log('Added users.profile_picture_url for optional farmer avatars.');
    }
    const [archivedProductColumn] = await pool.query("SHOW COLUMNS FROM products LIKE 'archived_at'");
    if (!archivedProductColumn.length) {
      await pool.query('ALTER TABLE products ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at');
      console.log('Added products.archived_at for non-destructive product archiving.');
    }
    const sql = await fs.readFile(path.join(__dirname, '..', 'migrations', '001_authentication.sql'), 'utf8');
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) await pool.query(statement);
    console.log('Authentication schema migration completed.');
  } catch (error) {
    console.error('Authentication schema migration failed:', error.code || error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
