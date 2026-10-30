# ParkSarthi

Existing accounts can sign in with **email and password**, **Google**, or **email OTP** (including Gmail). Email registration collects full name, email, password and mobile number, then requires an email OTP. Google verifies the email and new users complete their name and mobile details. Follow [AUTH-SETUP.md](./AUTH-SETUP.md) for provider configuration and the profile migration.

ParkSarthi connects drivers with hosts offering spare parking space and optional vehicle washing across Indian cities. Search shows approved host listings only. It stays empty until real spaces are submitted and reviewed; there is no sample catalogue or simulated checkout.

## Stack

Next.js and React with TypeScript, deployed as a Node.js web service on Render. Supabase provides PostgreSQL, verified email/password accounts and private photo storage. Razorpay order, verification and refund code is present, but customer booking remains disabled until live payment setup and operating arrangements are complete. Automatic host payouts are not implemented.

Start with [RENDER-SETUP.md](./RENDER-SETUP.md) for the provider accounts, migrations, secrets, login emails and deployment steps. [LAUNCH-GUIDE.md](./LAUNCH-GUIDE.md) covers real parking operations and payment launch. [GITHUB-GUIDE.md](./GITHUB-GUIDE.md) covers pushing updates to your repository.

## What is included

- Email/password registration, email confirmation, sign-in, sign-out and password recovery through Supabase Auth.
- Host photos, listing submission, administrator approval, pause controls, daily opening hours and blocked dates.
- City, vehicle and amenity filters, optional car washing, and transparent INR quotes with a 10% service fee.
- Server-side authorization and pricing, temporary payment holds, booking-capacity checks, payment verification and refund reconciliation.
- Driver and host dashboards showing actual live-payment records; host bookings refresh while the page is open.
- Private object storage with authorization through `/api/photos/...`; user-uploaded photos are not made into unrestricted public bucket URLs.

Automatic host onboarding/payouts, customer ratings/reviews, visitor analytics, phone OTP, schedule editing and staffed support remain unfinished. Approval of a listing does not guarantee physical security, insurance or protection against parking fines.

## Local development

Use the Node version in `.node-version`. Install dependencies with `npm ci --include=dev`. Copy `.env.example` to ignored `.env.local` and configure a separate Supabase development project. Keep `PAYMENT_MODE=disabled` and `LIVE_PAYMENTS_ENABLED=false`.

Apply the PostgreSQL migrations in `postgres/` in filename order, either in the Supabase SQL Editor or with `npm run db:migrate`. The migration command requires the database connection settings. Do not run the historical `drizzle/` SQLite migrations against PostgreSQL.

```sh
npm run dev
```

The local app runs at `http://127.0.0.1:5173`. Sign-in uses actual Supabase accounts; there is no automatic development identity. Set `APP_URL` and the Supabase auth redirect URLs for this local origin as described in the setup guide.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Automated tests use isolated fixtures and database tests; they do not establish that your hosted provider credentials, email delivery, live charges or bank payouts work. Check the actual deployment after configuring its accounts. A Render build can succeed without establishing a usable application database; `/api/health` verifies runtime readiness.

## Configuration

`.env.example` lists the supported environment names and safe defaults. `APP_URL` must be the canonical HTTPS website origin in production. `DATABASE_URL` uses Supabase's session pooler with verified TLS; `DATABASE_SSL_CA` supplies the optional Supabase CA PEM. `SUPABASE_SERVICE_ROLE_KEY`, database passwords and Razorpay secrets are server-only. Never commit local env files or put a service key in a `NEXT_PUBLIC_` variable.

`ADMIN_USER_IDS` contains Supabase user UUIDs, not emails or old Sites IDs. All successful registrations are visible in Supabase Authentication → Users. The app's own data lives in the `parksarthi` schema and private photos in the `parking-photos` bucket.

## Project map

| Location | Purpose |
| --- | --- |
| `app/marketplace.tsx`, `app/globals.css` | Marketplace UI and responsive styles |
| `app/auth/`, `lib/auth/`, `proxy.ts` | Supabase accounts, session validation and auth forms |
| `app/api/`, `lib/server/` | Listings, bookings, uploads, administration and payment operations |
| `db/`, `postgres/` | PostgreSQL adapter and versioned schema migrations |
| `lib/marketplace.ts`, `lib/payment-config.ts` | Validation, prices and booking-readiness gate |
| `tests/` | Isolated automated verification |
| `render.yaml` | Render service configuration |

The earlier Sites deployment, D1/R2 storage and ChatGPT account IDs are separate. This release does not copy them automatically. Any genuine existing records need an explicit data and identity migration before traffic is switched.
