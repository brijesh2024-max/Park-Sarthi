# ParkSaathi

A parking marketplace pilot for Indian cities. Hosts offer spare parking space and optional vehicle washing; drivers search, review a quote, and book. The first deployment is private and uses demo inventory and simulated bookings. It does not take real money or pay hosts by default.

## Stack

React and TypeScript on Vinext, Cloudflare Workers, D1 with Drizzle schema/migrations, and R2 for listing photos. Hosted identity comes from Sites' ChatGPT sign-in. Razorpay integration code handles orders, payment verification, and payment/refund webhooks when explicitly configured.

## Features and limits

- Multi-city discovery, vehicle and amenity filters, car-wash add-ons, and transparent INR quotes.
- Persistent driver bookings, a host listing dashboard, image uploads, and admin listing review.
- Server-side prices and authorization, booking capacity checks, payment holds, and explicit demo/test/live modes.
- Payment integration scaffolding needs merchant activation, credentials, and end-to-end provider testing before real use.
- Hosts set daily opening hours and blocked dates at listing creation; schedule editing and weekly recurring calendars are not included yet.
- Automatic host payouts, linked-account onboarding, SMS/phone OTP, and staffed customer support are not included.
- A listed amenity or admin approval is not a physical inspection, insurance policy, or security guarantee.

See [LAUNCH-GUIDE.md](./LAUNCH-GUIDE.md) for the owner setup and public-launch requirements, including the private-site webhook restriction and approved host settlement flow.

## Run locally

Use Node.js 22.13 or newer. Start in this directory. The project uses the portable profile on Windows, macOS, and ordinary Linux.

```sh
npm run install:ci
npm run build
```

The first build creates `dist/server/wrangler.json`, which local D1 commands need. Apply the committed SQL migrations in `drizzle/` in filename order, **once per fresh local database**. For each pending file, replace `<migration-file>` below with its exact filename:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/<migration-file>.sql
```

Then start the development server:

```sh
npm run dev
```

Open the printed local URL, normally `http://127.0.0.1:5173`. The portable preview simulates sign-in only on loopback; its Sign in link signs in as a local test identity. This development mechanism is excluded from hosted production. Use `npm start` to preview the built Worker locally; that mode does not simulate sign-in.

Local D1/R2 state lives under ignored `.wrangler/` and is separate from hosted data. Do not assume a local test record exists after deployment.

## Configuration

The checked-in [.env.example](./.env.example) contains names and safe defaults only:

| Variable | Purpose |
| --- | --- |
| `PAYMENT_MODE` | `demo` by default; `test` and `live` require matching Razorpay credentials. |
| `LIVE_PAYMENTS_ENABLED` | Additional explicit live-mode interlock; leave `false` for the pilot. |
| `ADMIN_USER_IDS` | Comma-separated stable Site user IDs allowed to review listings. Empty means no app admins. |
| `RAZORPAY_KEY_ID` | Public Checkout key ID from the matching provider environment. |
| `RAZORPAY_KEY_SECRET` | Server-only provider API secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Server-only webhook signing secret. |

Use an ignored `.dev.vars` file for local Worker values when needed. Put hosted values in Sites runtime environment settings, then redeploy. Never put secrets in client code, source control, the hosting manifest, or chat. The manifest's `DB` and `BUCKET` are logical resource bindings, not credentials.

## Database changes

Edit `db/schema.ts`, then generate and inspect a new migration:

```sh
npm run db:generate
npm run build
```

Apply only newly pending migrations to local D1 with the command above. Commit SQL and Drizzle metadata together. Do not rewrite a migration after it has been applied. The hosted publishing workflow applies hosted migrations separately; it does not copy local data.

## Verify

Run the backend unit, signature, scheduling, and concurrent database tests:

```sh
node --test tests/backend.test.mjs
```

With the migrated local development server running in demo mode and without an admin allowlist:

```sh
node tests/runtime-smoke.mjs
```

The smoke test writes a disposable booking, photo and draft listing to the loopback database and cancels the booking. It checks authentication, cross-origin write rejection, validation, authoritative pricing, persistence, cancellation, admin restrictions, forged payment rejection, image upload, photo privacy, and listing review/pause behavior. It refuses non-loopback targets. To select a different local port, set `SMOKE_ORIGIN` to that local origin before running it.

Compile the production artifact with `npm run build`. These checks do not exercise a real Razorpay transaction, bank refund, external webhook delivery, host settlement, or physical parking access. Follow the launch guide for those tests.

## Project map

| Location | Contents |
| --- | --- |
| `app/marketplace.tsx`, `app/globals.css` | Marketplace UI and responsive styling. |
| `app/api/` | Account, listing, booking, upload, admin, and payment endpoints. |
| `app/chatgpt-auth.ts` | Hosted identity helpers. |
| `lib/marketplace.ts` | Shared types, sample listings, validation, and pricing. |
| `lib/server/` | Database, authorization, and provider operations. |
| `db/`, `drizzle/` | Schema declarations and versioned SQL migrations. |
| `tests/` | Local verification scripts. |
| `.openai/hosting.json` | Site identity and D1/R2 binding declarations. |
| `worker/`, `scripts/` | Worker entry point and maintained build/runtime integration. |

## Deployment

Use the Sites publishing workflow for the existing project ID in `.openai/hosting.json`; do not create a second Site for an update. It synchronizes source, builds/packages the Worker, applies migrations, and deploys a saved version. Keep the private audience and demo mode until the owner approves the later public launch and the launch guide's requirements are complete.
