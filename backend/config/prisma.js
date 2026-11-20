const { PrismaClient } = require('@prisma/client');

function encode(value) {
  return encodeURIComponent(value ?? '');
}

const databaseUrl = process.env.DATABASE_URL || [
  'mysql://', encode(process.env.DB_USER), ':', encode(process.env.DB_PASSWORD),
  '@', process.env.DB_HOST || 'localhost', ':', Number(process.env.DB_PORT) || 3306,
  '/', encode(process.env.DB_NAME),
].join('');

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
