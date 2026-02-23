# Visual Jewellery Sourcing Platform

A B2B platform that transforms jewellery reference images into manufacturable product recommendations using AI vision and vector similarity search.

## Quick Start

```bash
# Prerequisites: Docker, Node.js 18+

# 1. Start PostgreSQL (MinIO is optional)
docker-compose up -d postgres

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your GEMINI_API_KEY + Firebase Storage credentials

# 4. Setup database
cd packages/database
npx prisma generate
npx prisma db push
cd ../..

# 5. Start development servers
npm run dev
```

## Services

| Service | URL | Port |
|---------|-----|------|
| External Portal | http://localhost:3000 | 3000 |
| Backend API | http://localhost:3001 | 3001 |
| Internal Dashboard | http://localhost:3002 | 3002 |
| MinIO Console (optional) | http://localhost:9001 | 9001 |

## Project Structure

```
├── apps/
│   ├── web/          # External user portal (Next.js)
│   └── dashboard/    # Internal ops dashboard (Next.js)
├── packages/
│   ├── api/          # Backend API (NestJS)
│   ├── database/     # Prisma schema & client
│   └── shared/       # Shared utilities
└── docker-compose.yml
```

## Features

- **AI Image Analysis**: Upload jewellery images for automatic attribute extraction
- **Vector Similarity Search**: Find matching products using embeddings
- **Inventory-First Sourcing**: Internal SKUs prioritized over external manufacturers
- **Request-to-Quote Workflow**: Complete B2B sourcing flow
- **Role-Based Access**: External, Sales, Sourcing, Admin roles

## Technology Stack

- **Frontend**: Next.js 14, Tailwind CSS, TypeScript
- **Backend**: NestJS, Prisma, PostgreSQL + pgvector
- **AI**: Google Gemini Vision API
- **Storage**: Firebase Storage

## Environment Variables

See `.env.example` for required configuration:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Authentication secret
- `GEMINI_API_KEY` - Google AI API key
- Firebase Storage credentials

## License

Proprietary - All rights reserved
