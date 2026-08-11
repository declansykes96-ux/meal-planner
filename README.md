# Meal Planner

Swipe-based meal planning for a week or fortnight. Lock keepers, skip the rest, open a card for full recipe details.

## Stack

- Next.js 16 (App Router, `src/`) + TypeScript + Tailwind CSS 4
- SQLite + Prisma 6

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed dinner library |
| `npm run db:reset` | Reset DB + reseed |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Out of scope (for now)

Coles, shopping lists, butcher, pantry, checkout, payments, live web recipe APIs.
