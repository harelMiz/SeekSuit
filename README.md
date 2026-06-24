# SeekSuit

SeekSuit is a fashion display website for an existing brick-and-mortar suit store. Customers browse the catalog online and visit the store to try on items. The platform includes AI-powered features: image background removal, hybrid visual+text product search, virtual try-on, and a business insight agent.

> **Architecture document:** see [`Management/Architecture/SeekSuit_Architecture_Document.docx`](Management/Architecture/SeekSuit_Architecture_Document.docx) for a full system design overview.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind CSS 4 |
| Backend | Node.js + Express 5 + TypeScript + Prisma 7 |
| Database | PostgreSQL + pgvector via Supabase (cloud) |
| AI Service | Python 3.11 + FastAPI + BiRefNet + CLIP (ViT-L/14) |
| Auth | Supabase Auth (admin only — no public registration) |
| Runtime | Docker (all services containerized) |
| CI/CD | GitHub Actions + GHCR (Virtual Try-On model builds) |

## Project Structure

```
SeekSuit/
├── Backend/              # Express API server (port 5000)
│   ├── src/
│   │   ├── controllers/  # Route handlers
│   │   ├── services/     # Business logic + AI integration
│   │   ├── routes/       # Express routers
│   │   └── lib/          # Prisma client, Supabase client
│   └── prisma/           # Schema + migrations
├── Frontend/             # React web app (port 5173)
│   └── src/
│       ├── pages/        # Route-level components
│       ├── components/   # Shared UI components
│       └── api/          # API client
├── AIService/            # Python microservice (port 8001)
│   └── background_removal/
│       └── app/          # FastAPI app + BiRefNet pipeline
└── Management/           # Project documentation
    └── Architecture/     # Architecture document + diagrams
```

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 24+ | Runs Backend + AI Service containers |
| [Node.js](https://nodejs.org/) | 20+ | Frontend dev server + Prisma CLI |
| [Python](https://www.python.org/) | 3.11+ | AI Service (if running outside Docker) |

## First-time Setup

**1. Clone and install frontend dependencies:**
```bash
git clone https://github.com/danieljenudi/SeekSuit.git
cd SeekSuit/Frontend
npm install
```

**2. Configure environment variables:**
```bash
cp .env.example Backend/.env
# Edit Backend/.env and fill in all values (Supabase, Gemini, RunPod, etc.)
```

**3. Apply database migrations:**
```bash
cd Backend
npm install
npx prisma migrate deploy
```

**4. Build Docker images (first time only):**
```bash
.\dev.ps1 --rebuild
```

## Quick Start

All services are managed via a single script from the project root:

```powershell
# Windows
.\dev.ps1

# With rebuild (after code changes to Backend or AIService)
.\dev.ps1 --rebuild
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |
| AI Service | http://localhost:8001 |
| AI Service docs | http://localhost:8001/docs |

> Frontend proxies all `/api/*` requests to the backend automatically.

## API Endpoints

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (filters: `type`, `color`, `status`, `search`) |
| GET | `/api/products/:id` | Get single product with images |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| PATCH | `/api/products/:id/images/order` | Reorder product images |

### Images

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/images/upload` | Upload raw image (Supabase storage) |
| POST | `/api/images/:id/process` | Trigger AI background removal |
| GET | `/api/images/unassigned` | List images not yet linked to a product |
| PATCH | `/api/images/:id` | Assign image to product / set as main |
| DELETE | `/api/images/:id` | Delete image |

### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search/text?q=` | Text search with Hebrew support + type/color hard filters |
| POST | `/api/search/image` | CLIP image search (multipart image upload) |
| POST | `/api/search/detect` | OWL-ViT clothing item detection in image |

### AI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai/insight` | LLM business insight agent (inventory analysis) |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Admin login (email + password via Supabase Auth) |
| POST | `/api/auth/logout` | Admin logout |
| GET | `/api/auth/me` | Current session |

## Frontend Routes

| Path | Page | Access |
|------|------|--------|
| `/` | Home — image/text search + featured products | Public |
| `/shop` | Full product catalog with filters | Public |
| `/products/:id` | Product detail + image gallery | Public |
| `/admin/login` | Admin login | Public |
| `/admin` | Dashboard — stats + AI insight agent | Admin |
| `/admin/inventory` | Product list + CRUD | Admin |
| `/admin/uploads` | Bulk image upload queue + AI processing | Admin |
| `/admin/models` | Virtual try-on — assign garments to model photos | Admin |

## Database Schema

### Product
| Field | Type | Notes |
|-------|------|-------|
| id | string | CUID |
| name | string | Display name |
| sku | string | Unique product code |
| type | enum | `JACKET` `PANTS` `SHIRT` `VEST` `SHOES` `TIE` `BOW_TIE` `BELT` |
| color | string | |
| status | enum | `IN_STOCK` `OUT_OF_STOCK` |
| attributes | JSON? | Type-specific metadata (material, fit, etc.) |
| clipEmbedding | vector(512)? | CLIP embedding for image search |

### ProductImage
| Field | Type | Notes |
|-------|------|-------|
| id | string | |
| productId | string? | Nullable — images can be unassigned |
| rawUrl | string | Supabase `raw-images` bucket |
| processedUrl | string? | Supabase `processed-images` bucket (post-AI) |
| isMain | bool | Primary display image |
| order | int | Display order within product |

### ProcessingJob
Tracks background-removal jobs: `PENDING → PROCESSING → DONE / FAILED`.

> No price, quantity, or size fields — customers visit the store to try on items.

## AI Features

### Background Removal
BiRefNet model removes backgrounds from raw product photos and applies canvas normalization: auto-crop, 8% padding, 1200×1600 portrait canvas, white background.

### Hybrid Image Search
Upload a photo or crop a garment — CLIP (ViT-L/14) encodes the image and queries pgvector for cosine similarity against all product embeddings. Results filtered by detected garment type and sorted by similarity.

### Text Search (Hebrew + English)
Full-text search with synonym expansion and hard filters for product type (Hebrew grammatical variants supported) and color.

### Virtual Try-On
FitDiT model (via RunPod serverless GPU) composites a selected garment onto a model photo. Admin interface assigns garments to model images and manages the try-on gallery.

### Business Insight Agent
LLM agent reads live inventory data and generates natural-language business insights on the admin dashboard (stock gaps, popular types, etc.).

## Progress

- [x] Backend CRUD API
- [x] Frontend foundation (Vite + React + routing + API client)
- [x] Core UI pages (catalog, product detail, admin forms, design system)
- [x] Admin authentication (Supabase Auth + JWT)
- [x] AI image processing pipeline (upload → BiRefNet → canvas normalization)
- [x] Hybrid image search (CLIP + pgvector)
- [x] Text search (Hebrew/English + type + color filtering)
- [x] Virtual try-on admin UX (FitDiT on RunPod)
- [x] Business insight agent (LLM on admin dashboard)
- [x] Testing & QA
- [ ] Production deploy — planned in coordination with store owner after academic submission
