# Farmer dashboard API

All `/api/farmer` requests require a farmer JWT in `Authorization: Bearer <token>`. The API derives the owner from that token; clients must not send a `farmerId` to select an account. Login returns the role and `mustChangePassword`; the frontend should route `FARMER` users to the farmer dashboard after any required first-login password change.

## Dashboard and profile

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/farmer/dashboard` | Real product, stock, inquiry, category, availability, and monthly listing metrics |
| POST | `/api/farmer/profile` | Create a farmer profile if one does not already exist |
| GET | `/api/farmer/profile` | Current farmer profile |
| PATCH | `/api/farmer/profile` | Update `fullName`, `email`, `phone`, `district`, `generalLocation`, or `farmDescription` |
| PUT | `/api/farmer/profile/picture` | Multipart upload with image field named `image` (JPEG, PNG, WebP; max 5 MB) |
| GET | `/api/farmer/categories` | Categories for product forms |

Farmer registration normally creates the profile automatically. The `POST /api/farmer/profile` endpoint supports a registered farmer whose profile is missing; it returns HTTP 409 if the profile already exists. Send a farmer bearer token and this JSON body:

```json
{
  "district": "Demo District",
  "generalLocation": "Demo Village",
  "farmDescription": "I grow beans and maize."
}
```

## Products and stock

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/farmer/products?search=&categoryId=&availability=&limit=20&offset=0` | List only the signed-in farmer's active listings |
| GET | `/api/farmer/products/:productId` | Get an owned product |
| POST | `/api/farmer/products` | Create a product; use JSON or multipart form with optional `image` |
| POST | `/api/farmer/products/bulk` | Create 1–50 products in one JSON request; all are saved together |
| PUT | `/api/farmer/products/:productId` | Update owned product fields; multipart form supports optional `image` |
| PATCH | `/api/farmer/products/:productId/stock` | Change `quantity`; optional `price`; zero stock marks unavailable |
| DELETE | `/api/farmer/products/:productId` | Archive the owned product, preserving inquiry history |

Create/update product fields: `productName`, `categoryId`, optional `description`, `price`, `unitOfMeasurement`, `quantity`, `availabilityStatus`, `district`, and `generalLocation`. Product location must match a configured district and village. The seeded local demo values are `Demo District` and `Demo Village`.

Bulk product creation accepts the same product fields inside a `products` array. Send a JSON body (bulk uploads do not include image files). The request is limited to 50 products and is atomic: if any product is invalid or references an unknown category or location, none of the products are created.

```json
{
  "products": [
    {
      "productName": "Red Beans",
      "categoryId": 1,
      "description": "Harvested this season",
      "price": 1200,
      "unitOfMeasurement": "kg",
      "quantity": 80,
      "district": "Demo District",
      "generalLocation": "Demo Village"
    },
    {
      "productName": "White Maize",
      "categoryId": 1,
      "description": "Dry maize grain",
      "price": 900,
      "unitOfMeasurement": "kg",
      "quantity": 120,
      "district": "Demo District",
      "generalLocation": "Demo Village"
    }
  ]
}
```

Example JSON for creating a product without an image:

```json
{
  "productName": "Demo Beans",
  "categoryId": 1,
  "description": "Freshly harvested beans",
  "price": 1800,
  "unitOfMeasurement": "kg",
  "quantity": 40,
  "district": "Demo District",
  "generalLocation": "Demo Village"
}
```

For image upload, choose **Body → form-data** and use one file field named `image`; add the remaining product fields as text fields.

## Buyer inquiries

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/farmer/inquiries?status=pending&limit=20&offset=0` | List inquiries for products owned by the signed-in farmer |
| GET | `/api/farmer/inquiries/:inquiryId` | Get an owned product inquiry and its responses |
| POST | `/api/farmer/inquiries/:inquiryId/responses` | Accept, decline, or message the buyer |

Response body example:

```json
{
  "action": "accepted",
  "message": "I can prepare this quantity for collection."
}
```

Inquiry decisions record communication only; they do not process payments or arrange delivery.

## Buyer marketplace

Buyer-authenticated routes under `/api/marketplace` read the same product rows, so stock and archive changes from the farmer API are reflected in listings. Buyers can list/view available products and submit or track inquiries. Archived listings are hidden from buyers while inquiry history remains available.
