# Belarro V4 — Crop Management Admin

Clean, professional crop administration system for Belarro vertical farm.

## Features

- **Unified Crop Admin:** One page, three tabs (Basics, Growth Procedure, Sizes & Prices)
- **Growth Procedure:** Linear sequence printable for farm workers
- **Flexible Sizing:** Standard sizes (100g, 225g, 450g) + custom sizes
- **Bilingual:** All fields in English and German
- **Real-time:** Data persists to Supabase immediately
- **Soft Delete:** Crops are soft-deleted, not permanently removed

## Tech Stack

- **Frontend:** Next.js 16 + React + Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma (schema only)

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `.env.local` with Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://wbqzlxdyjdmbzifhsyil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create Database Tables

Run these SQL commands in Supabase SQL editor:

```sql
-- Crops table
CREATE TABLE belarro_v4_crop (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_de TEXT NOT NULL,
  flavor_en TEXT,
  flavor_de TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP
);

-- Growth Procedure table
CREATE TABLE belarro_v4_growth_procedure (
  id TEXT PRIMARY KEY,
  crop_id TEXT UNIQUE NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  soak_enabled BOOLEAN DEFAULT false,
  soak_hours INTEGER,
  cover_soil_enabled BOOLEAN DEFAULT false,
  stack_enabled BOOLEAN DEFAULT false,
  stack_days INTEGER,
  growth_env_type TEXT,
  growth_env_days INTEGER,
  humidity_dome_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Product Variants table
CREATE TABLE belarro_v4_product_variant (
  id TEXT PRIMARY KEY,
  crop_id TEXT NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  size_name TEXT NOT NULL,
  size_grams FLOAT NOT NULL,
  price_eur FLOAT,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(crop_id, size_name)
);

-- Indexes
CREATE INDEX idx_crop_status ON belarro_v4_crop(status);
CREATE INDEX idx_crop_deleted_at ON belarro_v4_crop(deleted_at);
CREATE INDEX idx_variant_crop_id ON belarro_v4_product_variant(crop_id);
```

### 4. Start Dev Server

```bash
npm run dev
```

Open http://localhost:3000 → redirects to /admin/crops

## API Endpoints

### GET /api/crops

List all active crops.

```bash
curl https://yourapp.com/api/crops
```

### GET /api/crops?id=CROP_ID

Fetch single crop with all relations.

```bash
curl https://yourapp.com/api/crops?id=crop-123
```

### POST /api/crops

Create new crop.

```bash
curl -X POST https://yourapp.com/api/crops \
  -H "Content-Type: application/json" \
  -d '{
    "name_en": "Pea Shoots",
    "name_de": "Erbsensprossen",
    "flavor_en": "Sweet, crunchy",
    "flavor_de": "Süß, knackig",
    "status": "active",
    "procedure": { ... },
    "variants": [ ... ]
  }'
```

### PUT /api/crops/{id}

Update crop.

```bash
curl -X PUT https://yourapp.com/api/crops/crop-123 \
  -H "Content-Type: application/json" \
  -d '{ ... same as POST ... }'
```

### DELETE /api/crops/{id}

Soft delete crop.

```bash
curl -X DELETE https://yourapp.com/api/crops/crop-123 \
  -H "Content-Type: application/json" \
  -d '{"id": "crop-123"}'
```

## Deployment

### Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

```bash
vercel
```

### Manual

```bash
npm run build
npm start
```

## Testing Checklist

- [ ] Create new crop (all 3 tabs)
- [ ] Edit crop (change names, procedure, sizes)
- [ ] View crop (verify all data saved)
- [ ] Delete crop (soft delete)
- [ ] Search crops (by name)
- [ ] Toggle status (active ↔ paused)
- [ ] Add custom size (100g → 600g)
- [ ] Growth procedure calculation (total days shown)
- [ ] Bilingual fields (EN and DE)
- [ ] Error validation (required fields)

## File Structure

```
belarro-v4/
├── prisma/
│   └── schema.prisma          # Data model
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/crops/page.tsx   # Main admin page
│   │   │   ├── api/crops/route.ts     # API endpoint
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx               # Root (redirects)
│   │   └── globals.css
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── .gitignore
└── README.md
```

## Support

For issues, check:
1. Environment variables (.env.local)
2. Supabase tables exist
3. API endpoint responding
4. Browser console for errors

---

**Built with ❤️ for Belarro**
