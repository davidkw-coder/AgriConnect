# Authentication and authorization API

Farmer and buyer accounts are provisioned by an authenticated administrator. Public self-registration is disabled to match the project access policy. The initial administrator is provisioned locally with `npm run seed:admin`; credentials are read from `.env`, and the command refuses to create another admin if one already exists.

## Create a farmer

```http
POST /api/auth/register/farmer
Authorization: Bearer <administrator-token>
Content-Type: application/json
```

```json
{
  "fullName": "Aline Uwimana",
  "email": "aline@example.com",
  "phone": "+250788123456",
  "password": "TemporaryPass123!",
  "confirmPassword": "TemporaryPass123!",
  "district": "Demo District",
  "generalLocation": "Demo Village"
}
```

An admin may omit `password` to have the API generate a temporary password and return it once in the response. The farmer must change it at first login.

## Create a buyer

```http
POST /api/auth/register/buyer
Authorization: Bearer <administrator-token>
Content-Type: application/json
```

```json
{
  "fullName": "Jean Buyer",
  "email": "jean@example.com",
  "phone": "+250788123457",
  "password": "TemporaryPass123!",
  "confirmPassword": "TemporaryPass123!"
}
```

## Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "aline@example.com",
  "password": "TemporaryPass123!"
}
```

On success, the response contains `data.token`. Use it as a bearer token for protected routes. Passwords are validated for length and character variety, then hashed with bcrypt before storage. Email and phone uniqueness is enforced by the database and duplicate registration returns HTTP 409.

## Change password

```http
PUT /api/auth/change-password
Authorization: Bearer <current-token>
Content-Type: application/json
```

```json
{
  "currentPassword": "TemporaryPass123!",
  "newPassword": "MyNewStrongPass123!",
  "confirmPassword": "MyNewStrongPass123!"
}
```

Password changes increment the account token version, invalidating previously issued tokens. Log in again to obtain a new token.

## Read and update a profile

Every authenticated role can retrieve its own profile:

```http
GET /api/auth/me
Authorization: Bearer <token>
```

An account owner can also retrieve their profile by ID. An administrator may retrieve any user's profile:

```http
GET /api/auth/users/USER_ID
Authorization: Bearer <token>
```

All roles can update their own name, email, and phone. The route does not accept a user ID, role, or account status, so it cannot be used to edit another account or elevate privileges:

```http
PATCH /api/auth/me
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "fullName": "Aline Uwimana",
  "email": "aline.updated@example.com",
  "phone": "+250788123456"
}
```

At least one permitted field is required. The API validates names, email, and Rwanda phone numbers, normalizes email and phone, and returns HTTP 409 if another account already uses the email or phone. Farmers can additionally update farm description and location through `PATCH /api/farmer/profile`.

## Logout

```http
POST /api/auth/logout
Authorization: Bearer <token-from-login>
```

No request body is required. Logout records the token as revoked. The same endpoint works for administrators, buyers, and farmers. After success, the client should also remove its saved token.

## Role authorization

Protected farmer, buyer marketplace, and administrator account-management routes authenticate the token and load the current role and account status from the database. Requests with a missing, expired, revoked, or stale token are denied. Route access is restricted to the required role.
