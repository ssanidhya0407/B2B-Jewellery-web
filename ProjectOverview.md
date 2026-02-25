# Visual Jewellery Sourcing Platform: Project Overview

This document provides a comprehensive overview of the platform's internal technical structure and its business-driven logic.

## 1. Executive Summary
The Visual Jewellery Sourcing Platform is a B2B solution designed to bridge the gap between visual inspiration and manufacturable reality. Using AI-driven vision and vector similarity search, it allows jewellery brands and retailers to upload reference images and receive curated, manufacturable product recommendations.

---

## 2. Business Domain & Value Proposition

### 2.1 Core Problem & Solution
- **The Problem**: High friction in discovery, pricing, and MOQ (Minimum Order Quantity) overhead when sourced from global manufacturers (e.g., Alibaba).
- **The Solution**: A platform that abstracts supplier complexity, providing "Inventory-First" recommendations backed by internal stock or vetted manufacturers, with platform-controlled pricing.

### 2.2 User Roles
1.  **External Users (Brands/Retailers)**: Upload images, view recommendations, and submit "Request-to-Quote" (RTQ).
2.  **Sales (Internal)**: Manage customer communication and finalize quotations.
3.  **Sourcing (Internal)**: Validate manufacturability, map designs to inventory, and manage supplier costs.
4.  **Admin (Internal)**: Configure margin rules, manage catalogs, and control system permissions.

---

## 3. Internal Technical Structure

### 3.1 Repository Architecture
The project follows a **Monorepo** structure managed with **Turborepo** for efficient builds and scaling.

```text
├── apps/
│   ├── web/          # External user portal (Next.js 14)
│   └── dashboard/    # Internal operations dashboard (Next.js 14)
├── packages/
│   ├── api/          # Backend API (NestJS)
│   ├── database/     # Database layer (Prisma & PostgreSQL)
│   └── shared/       # Shared TypeScript types and utilities
└── docker-compose.yml # Local development infrastructure (Postgres, MinIO)
```

### 3.2 Technology Stack
- **Frontend**: Next.js 14, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: NestJS (Node.js framework), TypeScript.
- **Database**: PostgreSQL with `pgvector` for similarity search, Prisma ORM.
- **AI/Vision**: Google Gemini Vision API for attribute extraction and image analysis.
- **Storage**: Firebase Storage (production-grade cloud storage).

---

## 4. Core Business Logic

### 4.1 AI Image Interpretation
When a user uploads an image, the system:
1.  Extracts fine-grained attributes: *Category, Shape, Metal Visibility, Stone Density, Finish, and Occasion*.
2.  Converts these attributes into "Design Signals" for the search engine.

### 4.2 Sourcing Priority (The "System Truth")
For every recommendation (Primary and Alternatives), the system follows a strict priority:
1.  **Internal Inventory (Highest)**: If a matching SKU exists internally, it is prioritized.
2.  **External Manufacturer (Fallback)**: If no internal match, the system queries partner data (e.g., Alibaba) internally.
    - *Crucial*: Supplier identities are never shown to external users.

### 4.3 Pricing Engine
Prices shown to users are **Indicative Ranges**, calculated as:
`Base Cost (Inventory or Supplier) + Quality Buffer + Operational Overhead + Admin-Configured Margin`

---

## 5. Operational Workflows

### 5.1 The Sourcing Journey
1.  **Inspiration**: User uploads an image.
2.  **Recommendation**: System shows 1 Primary + 3–4 Alternatives.
3.  **Cart**: User adds preferred items to an "Intended Cart".
4.  **Request**: User submits the request; internal Sales & Sourcing teams are notified.
5.  **Quotation**: Internal teams refine the sourcing details and issue a formal quote back to the user.

### 5.2 Internal Collaboration
- The **Sourcing Team** receives tasks to verify the feasibility of AI-generated recommendations.
- They "Approve" or "Modify" the SKU mapping before the Sales team sends the final quote.

---

## 6. Development & Deployment
- **Environment**: Managed via `.env` containing keys for Database, Gemini, and Firebase.
- **Database Migrations**: Handled via Prisma (`npx prisma db push`).
- **Prerequisites**: Docker (for database), Node.js 18+.

---
*Proprietary - All rights reserved.*
