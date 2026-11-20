require('../config/env');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const encode = (value) => encodeURIComponent(value ?? '');
const databaseUrl = process.env.DATABASE_URL || [
  'mysql://', encode(process.env.DB_USER), ':', encode(process.env.DB_PASSWORD),
  '@', process.env.DB_HOST || 'localhost', ':', Number(process.env.DB_PORT) || 3306,
  '/', encode(process.env.DB_NAME),
].join('');
const prismaCli = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

if (result.error) {
  console.error(`Could not run Prisma CLI: ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
