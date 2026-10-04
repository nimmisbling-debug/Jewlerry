# Atelier Jewelry

A production-ready e-commerce platform for a fine-jewelry storefront: public
storefront, customer accounts, manual/offline payment workflow, order
lifecycle management, PDF invoices, notifications, and a full admin panel
(products, orders, payments, customers, reviews, banners, reports, FAQs,
settings).

Built with Next.js (App Router) + TypeScript + Tailwind + shadcn/ui on the
frontend, and Supabase (Postgres + Auth + Storage + RLS) on the backend —
designed to run entirely on free tiers (Vercel + Supabase) to start.

## Project status

This README is updated as each phase below completes. See
[`docs/PROGRESS.md`](./docs/PROGRESS.md) for a detailed running log.

| Phase | Status |
| --- | --- |
| 1. Project setup (Next.js, Tailwind, shadcn/ui, theme system, folder structure) | ✅ Done |
| 2. Database (migrations, RLS, seed data) | ✅ Done — verified against a real local Postgres |
| 3. Authentication & authorization | ✅ Done — verified end-to-end locally |
| 4. Products (CRUD, images, tags, search, filters, stock) | ✅ Done — verified in a real browser (Playwright) |
| 5. Storefront (home, product list, product detail, cart) | ✅ Done — verified in a real browser (Playwright) |
| 6. Orders (checkout, statuses, history) | ✅ Done — verified in a real browser (Playwright) |
| 7. Payments (methods, proof upload, approval) | ✅ Done — verified in a real browser (Playwright) |
| 8. Notifications & email | ✅ Done — verified in a real browser (Playwright) + real Gmail SMTP send |
| 9. Invoices (PDF) | ✅ Done — verified in a real browser (Playwright), real PDF inspected |
| 10. Reviews | ✅ Done — verified in a real browser (Playwright) |
| 11. Admin (dashboard/reports, settings, banners, FAQs, contact, customers, reviews moderation, notifications) | ✅ Done — verified in a real browser (Playwright + live), one real bug found & fixed |
| 12. Security/perf/a11y audit, tests, deployment docs | ✅ Done — real audit pass, 2 real gaps found & fixed |

## Tech stack

- **Frontend**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Lucide icons, React Hook Form + Zod, TanStack Table, Recharts
- **Backend**: Next.js Route Handlers + Server Actions + Server Components, Supabase (Postgres, Auth, Storage, RLS)
- **Email**: SMTP via Nodemailer (e.g. Gmail with an app password) — dev-mode console/log transport when `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` are unset
- **PDF invoices**: `@react-pdf/renderer` (server-side)
- **Cart state**: Zustand, persisted to `localStorage` only — never the database
- **Testing**: Vitest + Testing Library

## Prerequisites

- **Node.js 22+ strongly recommended.** Next.js 16 itself only requires
  20.9+, but `@supabase/supabase-js` now targets Node 22+ and its
  `RealtimeClient` needs a native `WebSocket` global (added in Node 22).
  This repo runs on Node 20.17 via two small compatibility shims —
  `jsdom` pinned to `25.0.1` (latest requires Node's `require(esm)`,
  20.19+/22.13+) and a `ws`-based `WebSocket` polyfill in
  `src/instrumentation.ts` + `scripts/seed.ts` (see comments there). Both
  are safe to remove once you're on Node 22+.
- npm 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — only if you want to run Supabase locally (recommended for development; see below). Not needed if you develop directly against a hosted Supabase project.
- A free [Supabase](https://supabase.com) account/project (for staging/production; optional for local-only development)
- A free [Vercel](https://vercel.com) account (for deployment)
- [Supabase CLI](https://supabase.com/docs/guides/local-development) — already installed as a dev dependency, use via `npx supabase ...`

## 1. Supabase setup

You can develop against a fully local Supabase stack (fast, free, no
account needed) or a hosted project. Both use the same migrations/seed.

### Option A — Local (recommended for development)

```bash
npx supabase start
```

This pulls the Supabase Docker images (first run only, a few minutes),
starts a local Postgres, applies every migration in
`supabase/migrations/`, and runs `supabase/seed.sql`. It prints an
`API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` — copy those into
`.env.local` (see below). Supabase Studio (a local dashboard for browsing
tables/auth/storage) is served at `http://127.0.0.1:54323`.

Stop it with `npx supabase stop` (add `--no-backup` to also wipe the local
database).

### Option B — Hosted project

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to the client)
3. Link it and push the migrations: `npx supabase link --project-ref YOUR_PROJECT_REF`, then `npx supabase db push`.
4. Run `psql "$DATABASE_URL" -f supabase/seed.sql` (or paste it into the SQL editor in the dashboard) to load sample catalog data.
5. *(Filled in during a later phase)* Configure Auth redirect URLs and email templates for production.

## 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values from step 1 above (local or hosted). Never commit `.env.local`.

## 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. Database migrations & seed data

If you used `npx supabase start` (Option A above), migrations and
`seed.sql` were already applied. To re-apply after pulling new migrations:

```bash
npm run db:migrate   # supabase db push (hosted) — for local, use `npx supabase db reset` to reapply everything
```

Then bootstrap the admin account (works against either local or hosted,
based on the Supabase URL/keys in `.env.local`):

```bash
npm run seed
```

## 5. Admin bootstrap

`npm run seed` creates a single admin account from `ADMIN_BOOTSTRAP_*` env
vars via the Supabase Auth admin API (not raw SQL — `auth.users` is
Supabase-managed), and sets `must_change_password` so the default password
is forced to change on first login (redirected to `/force-password-change`
automatically). The password is never logged or returned by any API. Sign
in at `/sign-in` with `ADMIN_BOOTSTRAP_USERNAME` — admins land on
`/admin`, customers on `/account`.

## 6. Testing

```bash
npm run typecheck
npm run lint
npm run test
```

## 7. Deployment (Vercel + Supabase, free tier)

Everything below assumes you already have a hosted Supabase project
(Option B in step 1) with migrations pushed and `seed.sql` loaded — Vercel
hosts the Next.js app only; Supabase remains the database/auth/storage
backend regardless of where the app itself runs.

### 7.1 Push to GitHub

Vercel deploys from a Git repository. If you haven't already:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 7.2 Import the project into Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   select this repo. Vercel auto-detects Next.js; no build command changes
   are needed.
2. Before the first deploy, add the environment variables below (**Project
   Settings → Environment Variables**), applied to all three
   environments (Production/Preview/Development) unless noted otherwise.
   These are exactly the fields in `.env.example`:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (**server-only** — Vercel never exposes non-`NEXT_PUBLIC_*` vars to the browser, but double-check you didn't rename it) |
   | `NEXT_PUBLIC_SITE_URL` / `SITE_URL` | Your public domain, e.g. `https://www.nimmisbling.com` — **not** the `*.vercel.app` URL, or auth email links will point there. `NEXT_PUBLIC_*` values are inlined at build time, so **redeploy** after changing it |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Your SMTP provider — ideally the same one Supabase Auth uses (7.3b), e.g. Resend: `smtp.resend.com`, `465`, `resend`, your Resend API key. (Gmail also works: `smtp.gmail.com`, `465`, your address, an [app password](https://myaccount.google.com/apppasswords) — not your normal password) |
   | `EMAIL_FROM` | e.g. `"Nimmis Bling <no-reply@nimmisbling.com>"` (the domain must be verified with your SMTP provider) |
   | `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD` / `ADMIN_BOOTSTRAP_EMAIL` | Only needed once, for `npm run seed` — see 7.4 |
   | `CRON_SECRET` | A random secret (`openssl rand -hex 32`) — enables the auto-cancel-orders cron (7.6) and is otherwise required for that route to respond at all |

   Leaving `SMTP_*` unset is fine — the app falls back to logging emails
   to the server console instead of failing.

3. Deploy. Vercel builds with `next build` and serves everything as
   Node.js serverless functions (this app has no Edge runtime routes, so
   the Node 22+ `WebSocket` requirement `src/instrumentation.ts` handles
   locally is a non-issue on Vercel's own Node runtime either way).

### 7.3 Point Supabase Auth at your real domain

**a) Custom domain and redirect URLs.**

First, in Vercel → **Settings → Domains**, add `www.nimmisbling.com` and
`nimmisbling.com` and add the DNS records Vercel shows at your registrar
(GoDaddy → **My Products → DNS**). Make `www.nimmisbling.com` the primary
domain and redirect the apex and the `*.vercel.app` URL to it.

Then in the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://www.nimmisbling.com` (must match
  `NEXT_PUBLIC_SITE_URL` above)
- **Redirect URLs**: add
  - `https://www.nimmisbling.com/auth/callback`
  - `https://www.nimmisbling.com/**`
  - `https://nimmisbling.com/**`
  - optionally `https://*.vercel.app/auth/callback` for preview deployments

The app sends `emailRedirectTo: ${NEXT_PUBLIC_SITE_URL}/auth/callback`
([src/lib/auth/actions.ts](src/lib/auth/actions.ts)). If that URL isn't in
the allow-list, Supabase silently falls back to the **Site URL**. That's
why links end up on `localhost` or the `*.vercel.app` URL instead of your
domain.

**b) Send auth emails from your own domain.**

By default Supabase sends signup-confirmation and password-reset emails
from its own shared sender (`noreply@mail.app.supabase.io`), and it only
allows a few emails per hour. The app's `SMTP_*` variables **do not**
affect these emails; they only cover the app's own notifications. To send
as Nimmis Bling:

1. Create a [Resend](https://resend.com) account → **Domains → Add
   Domain** → `nimmisbling.com`.
2. Add the DNS records Resend shows (an MX record and TXT records for SPF
   and DKIM) in GoDaddy → **DNS → Add New Record**. Copy the values
   exactly, then wait until Resend shows the domain as **Verified**.
3. Create a Resend API key.
4. Supabase → **Authentication → Emails → SMTP Settings → Enable Custom
   SMTP**:

   | Field | Value |
   | --- | --- |
   | Sender email | `no-reply@nimmisbling.com` |
   | Sender name | `Nimmis Bling` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key |

5. Supabase → **Authentication → Emails → Templates**: rebrand the
   "Confirm signup" and "Reset password" subject and body. Keep
   `{{ .ConfirmationURL }}` in the body; that's the link itself.

To check it works, sign up with a new address. The email should come from
Nimmis Bling, and the link should open
`https://www.nimmisbling.com/auth/callback?...`. Emails sent before the
change still carry the old link.

### 7.4 Bootstrap the admin account against the hosted project

Run this **once**, from your own machine, pointed at the hosted project
(never commit these values — pass them inline for one command):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
ADMIN_BOOTSTRAP_USERNAME=admin \
ADMIN_BOOTSTRAP_PASSWORD='ChangeMe123!' \
ADMIN_BOOTSTRAP_EMAIL=admin@yourdomain.com \
npm run seed
```

Sign in at `https://www.nimmisbling.com/sign-in` with that username/
password — you'll be forced to change it immediately
(`must_change_password`), and the bootstrap password is never stored or
retrievable after that.

### 7.5 Storage buckets, image domains, and other things migrations already set up

Running the migrations (`npx supabase db push`, done once when you first
linked the hosted project — see step 1) already created the storage
buckets (`product-images`, `banners`, `avatars` public;
`payment-proofs` private) and their RLS policies. Nothing extra to
configure here — `next.config.ts`'s `images.remotePatterns` derives the
allowed host straight from `NEXT_PUBLIC_SUPABASE_URL`, so no manual image
domain configuration is needed either.

### 7.6 The auto-cancel-orders cron job

`vercel.json` already declares a daily cron
(`/api/cron/auto-cancel-orders` at 03:00 UTC) that cancels `unconfirmed`
orders older than `admin_settings.order_auto_cancel_unconfirmed_hours`
(configurable from **Admin → Settings → Automation**, default 48h).
Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
invocations when a `CRON_SECRET` env var is set on the project — no
further wiring needed once that env var exists. The **Hobby (free)
plan** limits cron jobs to once per day; upgrade to Pro for hourly (or
finer) granularity if a full day's delay before auto-cancellation matters
for your store.

### 7.7 Post-deploy smoke test

- Sign up a real (or throwaway) customer account and confirm the
  confirmation email arrives and its link lands back on your real domain,
  not localhost.
- Place a test order, submit a (fake) payment proof, approve/reject it as
  admin, and confirm both the in-app notification and email arrive.
- Download an invoice PDF from an order detail page.
- Check `/robots.txt` and `/sitemap.xml` resolve.

### 7.8 Ongoing deploys

Every push to `main` redeploys automatically; pull requests get their own
preview deployment URL. Database migrations are **not** applied
automatically — run `npx supabase db push` yourself (pointed at the
hosted project) whenever you add a new migration, before or alongside
deploying the code that depends on it.

## Architecture notes / decisions

Documented here as they're made, since the original spec leaves some
implementation details open:

- **Next.js 16**: this project was scaffolded on Next.js 16.3.4, which
  renamed `middleware.ts` → `proxy.ts` (function `proxy`, Node.js runtime
  only) and made several other breaking changes vs. Next 15. Route
  protection lives in `src/proxy.ts`.
- **Cart**: Zustand store persisted to `localStorage` (per spec Rule 7) —
  never written to the database. Stock is re-validated server-side on
  cart-open/checkout (Rule 8).
- **PDF invoices**: generated server-side with `@react-pdf/renderer` from
  data recomputed/read from the database (never trusting client totals).
- **Rate limiting**: a lightweight Postgres-backed limiter for auth
  endpoints (no Redis), to stay on free-tier infrastructure.
- **Currency**: PKR (`en-PK`), matching the JazzCash/EasyPaisa payment
  method examples in the spec. Change `CURRENCY` in `src/constants/index.ts`
  if needed.

## Security checklist

Tracked in [`docs/SECURITY.md`](./docs/SECURITY.md), finalized in Phase 12.
