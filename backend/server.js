require('./config/env').validateEnvironment();

const app = require('./app');
const { checkDatabaseConnection } = require('./config/database');
const prisma = require('./config/prisma');
const { port } = require('./config/env').validateEnvironment();

const server = app.listen(port, () => {
  console.log(`AgriConnect API listening on port ${port} (${process.env.NODE_ENV})`);
  checkDatabaseConnection()
    .then(() => console.log('MySQL database connection established'))
    .catch((error) => console.error('MySQL connection failed:', error.code || error.message || error));
});

server.on('error', (error) => {
  console.error(`Unable to start server: ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
