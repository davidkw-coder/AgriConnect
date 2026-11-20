const prisma = require('./prisma');

async function checkDatabaseConnection() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
}

module.exports = { prisma, checkDatabaseConnection };
