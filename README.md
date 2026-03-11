# SeekSuit

SeekSuit is a fashion display website for an existing suit store, with AI-powered features for image enhancement and product search. Customers browse the catalog online and visit the store to try on items.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 5 + TypeScript + Prisma 7 |
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind CSS 4 |
| Database | PostgreSQL via Supabase (cloud) |
| Auth | Supabase Auth (admin only) |
| Runtime | Docker (Node 20 Alpine) |

## Project Structure

```
SeekSuit/
├── Backend/       # Express API server
└── Frontend/      # React web app
```

## Backend

REST API built with Express 5 + Prisma 7 + TypeScript.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products (supports filters) |
| GET | `/api/products/:id` | Get a single product |
| POST | `/api/products` | Create a product |
| PATCH | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |

**Running the backend (Docker):**

```bash
cd Backend
./dev.bat
```

The server starts on `http://localhost:5000`.

## Frontend

React 19 + Vite 6 + TypeScript + Tailwind CSS 4.

**Running the frontend:**

```bash
cd Frontend
npm install
npm run dev
```

The app starts on `http://localhost:5173`. All `/api/*` requests are proxied to `localhost:5000`.

**Routes:**

| Path | Page |
|------|------|
| `/` | Product list |
| `/products/:id` | Product detail |
| `/products/new` | Add new product |
| `/products/:id/edit` | Edit product |

## Product Schema

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Display name |
| sku | string | Product code (unique) |
| type | enum | JACKET / PANTS / SHIRT / VEST / SHOES / TIE / BOW_TIE / BELT |
| color | string | Color |
| status | enum | in_stock / out_of_stock |
| rawImageUrl | string? | Original uploaded image |
| processedImageUrl | string? | AI-enhanced image |
| attributes | JSON? | Type-specific fields (e.g. material, fit) |

## Progress

- [x] Step 1 — Backend CRUD API
- [x] Step 2 — Frontend Foundation (Vite + React + routing + API client)
- [ ] Step 3 — Core UI Pages (product list, detail, form)
- [ ] Step 4 — Auth (admin login)
- [ ] Step 5 — Deploy (backend → Render, frontend → Vercel)
- [ ] Step 6 — Collections
- [ ] Step 7 — AI Integration (image enhancement, hybrid search, insight agent)
- [ ] Step 8 — Testing
