# Jupitar Ecom

A private, single-operator product-research pipeline for eBay dropshipping. Replaces a
spreadsheet: import candidate products, edit them in a spreadsheet-grade grid, and get
live margin/ROI/verdict metrics recomputed from cost, fees, VAT, and FX on every edit.

Every derived number (fees, margin %, ROI %, verdict) is computed on the fly from stored
inputs and the current settings — nothing derived is ever persisted, so changing a
setting (VAT rate, FX rates, minimum margin bar) instantly recalculates the entire
pipeline.

## Tech stack

- Next.js 16 (App Router, Turbopack, Server Actions) + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui, dark-only "matte charcoal + copper" design system
- Drizzle ORM against Neon Postgres (serverless HTTP driver)
- TanStack Table + TanStack Virtual for the product grid
- Zod for shared validation (UI, Server Actions, CSV import)
- Recharts for the dashboard, Papa Parse for CSV import/export

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Provision a Neon Postgres database**

   - Create a free project at [neon.tech](https://neon.tech).
   - Copy the pooled connection string from the Neon console (it looks like
     `postgresql://<user>:<password>@<host>/<db>?sslmode=require`).

3. **Configure environment variables**

   Create `.env.local` in the project root:

   ```bash
   DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
   ```

4. **Run migrations**

   ```bash
   npm run db:migrate
   ```

   To generate a new migration after changing `src/db/schema.ts`:

   ```bash
   npm run db:generate
   ```

5. **(Optional) Seed sample data**

   ```bash
   npm run db:seed
   ```

6. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command               | Purpose                                        |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack)                |
| `npm run build`        | Production build                                |
| `npm run start`        | Serve the production build                      |
| `npm run lint`         | ESLint                                          |
| `npm run test`         | Run the Vitest suite once                       |
| `npm run test:watch`   | Run Vitest in watch mode                        |
| `npm run db:generate`  | Generate a Drizzle migration from schema diffs  |
| `npm run db:migrate`   | Apply pending migrations to `DATABASE_URL`      |
| `npm run db:seed`      | Seed the database with sample products          |

## Deploying

### Database (Neon)

Production and local development can point at the same Neon project, or you can create
a separate Neon branch/project for production:

1. In the Neon console, create a new project (or branch off your dev project).
2. Copy its connection string and run `npm run db:migrate` locally with `DATABASE_URL`
   set to that string (or run migrations as a one-off step in your deploy pipeline).
3. Neon branches are cheap — a common pattern is one branch per environment
   (`dev`, `preview`, `production`).

### App

Any Next.js host works (Vercel, a Node server, etc.):

1. Set `DATABASE_URL` in the host's environment variables to your production Neon
   connection string.
2. Build with `npm run build`, run with `npm run start` (or let the host build it, e.g.
   Vercel auto-detects Next.js).
3. Run `npm run db:migrate` against the production `DATABASE_URL` before or as part of
   the first deploy.

## Known trade-offs

- **Bundle size**: route JS is roughly 220–320 KB gzip depending on the page (measured
  via CDP `encodedDataLength`, not estimated), against an original 150 KB budget.
  Route-level code-splitting is correctly scoped — Recharts only loads on `/dashboard`,
  TanStack Table/Virtual only on `/`, Zod only on `/` and `/import` — so this isn't a
  splitting bug. The floor is the mandated stack itself (React 19 + Radix/shadcn +
  TanStack Table/Virtual + Recharts), which costs more than 150 KB gzip before any
  app code runs.
- **Lighthouse performance**: accessibility scores 100/100 on every route (mobile and
  desktop). Performance under Lighthouse's default mobile throttling (slow 4G, 4x CPU)
  ranges 49–93 depending on the route, driven by the same bundle-size floor plus a
  ~900ms Neon round-trip on first load. Under a desktop profile — the realistic use
  case for a single-operator internal tool — three of four routes score 98–100; the
  dashboard sits at ~80, bound by Recharts' own render cost with 2,000 data points.
