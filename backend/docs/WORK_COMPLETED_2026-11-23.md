# AgriConnect Backend Work Summary

**Date:** 23 November 2026  
**Scope:** Authentication and authorization, user profiles, farmer operations, product listings, and buyer inquiries.

## 1. Authentication and authorization

- Added and documented login for admin, buyer, and farmer accounts through `POST /api/auth/login`.
- Farmer and buyer accounts are provisioned by an authenticated administrator. Public self-registration is disabled to match the account-management requirement. Initial admin provisioning uses the local `npm run seed:admin` process.
- Registration validates names, email addresses, Rwanda phone numbers, and password strength. Duplicate email or phone numbers are rejected.
- Passwords are hashed with bcrypt before storage. Admin-created accounts can require a temporary password change at first login.
- JWT authentication checks expiration, revocation, token version, current account status, and current database role.
- Role middleware protects farmer, buyer, and admin routes.
- Logout revokes the current token through `POST /api/auth/logout`.
- Authenticated password changes use `PUT /api/auth/change-password` and invalidate old tokens.
- Added a minimum 32-byte check for `JWT_SECRET`.

## 2. User profiles

- `GET /api/auth/me` retrieves the logged-in user's profile.
- `PATCH /api/auth/me` allows a user to update their own name, email, and phone number after validation.
- `GET /api/auth/users/:userId` allows users to retrieve their own profile by ID; admins can retrieve any user's profile.
- Profile updates do not accept role or account-status changes. Duplicate email or phone numbers return a conflict response.
- Farmer-specific farm details and location remain available through `GET` and `PATCH /api/farmer/profile`.

## 3. Farmer profile creation

- Added `POST /api/farmer/profile` for a registered farmer whose profile is missing. The request validates district, village, and optional farm description against configured data.
- Farmer registration normally creates the farmer profile automatically. Therefore, `POST /api/farmer/profile` returns `409 Farmer profile already exists` when the profile is already present. Use `GET /api/farmer/profile` to view it and `PATCH /api/farmer/profile` to update it.

## 4. Farmer products and marketplace activities

- Farmers can list their own products, retrieve an owned product, create, update, adjust stock, and archive products through `/api/farmer/products` routes.
- Added bulk product creation at `POST /api/farmer/products/bulk`. It accepts 1–50 products as JSON and creates them atomically; if an item is invalid, none from that request are created. Bulk creation does not support image uploads.
- Farmers can list inquiries about their products, retrieve inquiry details and responses, and accept, decline, or message buyers.
- Product and inquiry queries derive ownership from the authenticated farmer. Product update, stock, archive, inquiry retrieval, and inquiry response operations verify that ownership.
- Buyers can browse available products and submit and track inquiries through `/api/marketplace` routes.

## 5. Prisma ORM and database preservation

- Added Prisma Client and introspected the existing MariaDB schema into `prisma/schema.prisma`.
- Converted backend runtime data access for authentication, farmer operations, marketplace operations, and admin account management to Prisma Client.
- The existing database was introspected without running a migration, reset, or schema push; existing tables and records were not changed as part of the Prisma setup.
- Added Prisma CLI helper commands: `npm run prisma:pull`, `npm run prisma:generate`, and `npm run prisma:validate`.
- Existing migration and seed scripts continue to use the legacy MySQL client.

## 6. Validation performed

- JavaScript syntax checks passed for the files changed in the profile and farmer API work.
- Prisma schema validation passed.
- No automated API or database integration tests were run as part of these changes.

## 7. API references

- [Authentication API](AUTH_API.md)
- [Farmer API](FARMER_API.md)
- [Prisma ORM notes](PRISMA.md)
