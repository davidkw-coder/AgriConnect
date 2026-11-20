# Prisma ORM

The backend uses Prisma Client for application database access. `prisma/schema.prisma` was introspected from the existing MariaDB database; its existing tables, columns, and records were not recreated or reset.

The application reads the existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` values from `.env`. An optional `DATABASE_URL` can override the connection string.

Useful commands:

- `npm run prisma:generate` generates the local Prisma Client.
- `npm run prisma:validate` checks the Prisma schema.
- `npm run prisma:pull` reads the current database schema and refreshes `prisma/schema.prisma`.

`prisma:pull` only introspects the database. Avoid `prisma db push`, `prisma migrate reset`, or destructive migrations when the existing database must be preserved. After changing a table outside Prisma, run `npm run prisma:pull` and then `npm run prisma:generate`.
