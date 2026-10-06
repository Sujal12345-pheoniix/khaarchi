# HomeExpense — Engineering Runbook

## 1. Quick Start

### Prerequisites
- Node.js `v20+` or `v24+`
- pnpm `v10+` or `v12+`
- PostgreSQL (Neon Cloud DB or local Docker)

### Installation
```bash
# Install workspace dependencies
pnpm install

# Approve build scripts (if prompted by pnpm v12)
pnpm approve-builds --all
```

---

## 2. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance:
```env
DATABASE_URL="postgresql://neondb_owner:npg_n2dYaiIqCGX9@ep-damp-surf-b4dt7n4k-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

---

## 3. Database Synchronization

To synchronize the Prisma schema with the database:
```bash
pnpm --filter @homeexpense/database run prisma:db:push
```

---

## 4. Running the Development Environment

Run backend API:
```bash
pnpm dev:api
```
- API Endpoint: `http://localhost:4000/api/v1`
- Interactive OpenAPI / Swagger Docs: `http://localhost:4000/api/docs`

Run frontend Next.js application:
```bash
pnpm dev:web
```
- Web Application: `http://localhost:3000`

---

## 5. Verification & Testing

Run unit & invariant tests:
```bash
pnpm test
```

Run complete production builds:
```bash
pnpm build
```
