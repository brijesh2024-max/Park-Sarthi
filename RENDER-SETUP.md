# Deploy ParkSarthi on Render with Supabase

Updated 29 October 2026. This guide deploys the Node.js version of ParkSarthi. It uses Supabase for PostgreSQL, real email/password accounts and private photo storage. The marketplace starts empty; real host listings appear after administrator approval. Payments remain disabled until the separate payment and host-settlement work is ready.

The repository is [brijesh2024-max/Park-Sarthi](https://github.com/brijesh2024-max/Park-Sarthi). Configuration values belong in your provider dashboards or an ignored local `.env.local` file. Do not paste passwords, service keys or connection strings into chat or GitHub.

## 1. Create your Supabase project

1. Sign in to [Supabase](https://supabase.com/dashboard) and create a project in your own organisation. Choose a region near your Render service and your Indian customers.
2. Save the project's database password privately. Wait for project provisioning to finish.
3. From the project's Connect dialog and **Settings → API Keys**, copy its project URL, publishable key (`sb_publishable_...`), and server secret key (`sb_secret_...`). This app reads the secret key from the environment variable `SUPABASE_SERVICE_ROLE_KEY`; the older variable name also supports a legacy `service_role` key. Prefer the new secret key for a new project. It belongs only on the Render server; never use it in browser code or a variable prefixed `NEXT_PUBLIC_`. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
4. Open **Connect → Session pooler** and copy the PostgreSQL URI. Use the session pooler, usually port `5432`, with its full `postgres.<project-ref>` username. Replace the password placeholder with your database password, URL-encoding special characters in that password. Store the resulting URI as `DATABASE_URL`.

The session pooler supports IPv4, which avoids depending on direct-database IPv6 connectivity. The app verifies TLS certificates and hostnames. If the endpoint requires Supabase's CA, download the project's certificate from Database settings and put its full PEM text in `DATABASE_SSL_CA`. Do not disable certificate verification. [Supabase connection options](https://supabase.com/docs/guides/database/connecting-to-postgres) · [SSL verification](https://supabase.com/docs/guides/platform/ssl-enforcement)

## 2. Create the database tables and private bucket

In Supabase **SQL Editor**, run these complete repository files in order:

1. `postgres/0001_marketplace.sql`
2. `postgres/0002_supabase.sql`

Alternatively, an operator with `DATABASE_URL` and the optional CA configured can run `npm run db:migrate` from the project folder. Use one method and check that it succeeds before continuing.

The first migration creates the marketplace tables in the `parksarthi` schema, keeping them outside the ordinary public Data API. The second adds user profiles and creates the private `parking-photos` storage bucket. Do not run the old `drizzle/` SQLite migrations on PostgreSQL.

In Supabase **Storage**, verify the bucket exists, is **private**, accepts only JPEG/PNG/WebP, and has a **5 MB** limit. Keep `SUPABASE_STORAGE_BUCKET=parking-photos` unless you deliberately create and configure another private bucket. The app serves photos through `/api/photos/...` after its own ownership/listing checks; it does not publish unrestricted Storage URLs. [Private bucket behaviour](https://supabase.com/docs/guides/storage/buckets/fundamentals)

## 3. Push this version to GitHub

Follow [GITHUB-GUIDE.md](./GITHUB-GUIDE.md) to commit and push the migration. Confirm that `postgres/`, `render.yaml`, `next.config.*`, the auth pages and the updated `package.json` appear in your repository. Do not use an older commit containing only the Cloudflare Worker build.

## 4. Create the Render web service

In [Render](https://dashboard.render.com), create a **Web Service** and connect the repository. Use:

| Setting | Value |
| --- | --- |
| Repository | `brijesh2024-max/Park-Sarthi` |
| Branch | `main` |
| Root directory | Leave blank: `package.json` is at the repository root |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Node version | Use the committed `.node-version` |

The start command binds to `0.0.0.0` and the `PORT` supplied by Render. This app needs a running Node server for login and API routes; do not deploy it as a static site. No Render disk is needed for records or photos because they live in Supabase. [Render's Next.js guide](https://render.com/docs/deploy-nextjs-app)

The included Blueprint starts with Render's Free instance for setup. Free web services can sleep and Render does not recommend them for production; choose an appropriate paid instance before accepting real parking transactions. [Render Free limits](https://render.com/docs/free)

## 5. Enter Render environment values

Add the following in the service's **Environment** settings. These are runtime values, not text to commit to the repository.

| Variable | Value |
| --- | --- |
| `APP_URL` | Your exact HTTPS Render origin, for example `https://your-service.onrender.com`, without a path |
| `DATABASE_URL` | Supabase session-pooler PostgreSQL URI including the database password |
| `DATABASE_SSL_CA` | Optional full PEM certificate when needed for the Supabase endpoint |
| `SUPABASE_URL` | Supabase project's HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; legacy anon key is also supported |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server secret key (`sb_secret_...`); a legacy service-role key also works |
| `SUPABASE_STORAGE_BUCKET` | `parking-photos` |
| `ADMIN_USER_IDS` | Leave empty until you register your administrator account |
| `PAYMENT_MODE` | `disabled` |
| `LIVE_PAYMENTS_ENABLED` | `false` |

Use the actual service URL Render assigns. If the first deploy starts before you know that URL, update `APP_URL` once it appears and redeploy. When you later add a custom domain, update this value and Supabase's allowed URLs together.

Deploy the service and inspect the logs. `/api/health` returns an unavailable status until required services are configured and the database migrations are present. A successful JavaScript build alone does not confirm that the database, email or photos work.

## 6. Configure real signup and recovery email

**For the current Google and email OTP login, follow [AUTH-SETUP.md](./AUTH-SETUP.md) first.** It replaces the password-signup instructions and confirmation templates below. Recovery instructions below apply only to existing password accounts.

In Supabase **Authentication**:

1. Enable email/password signup and keep **Confirm email** enabled.
2. Set **Site URL** to exactly the same HTTPS origin as Render's `APP_URL`.
3. Add these redirect URLs, replacing `YOUR_ORIGIN` with that origin:
   - `YOUR_ORIGIN/auth/callback`
   - `YOUR_ORIGIN/auth/callback?next=/auth/reset-password`
4. In **Email Templates → Confirm signup**, use a link with this target:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm your email</a>
```

5. In **Email Templates → Reset password**, use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
```

6. Configure a real SMTP provider and verified sender for emails to your customers. Supabase's default sender is restricted and is not a production email service. Test delivery and expiry before opening signup to customers. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)

The application's pages are `/auth/sign-up`, `/auth/sign-in`, `/auth/forgot-password`, `/auth/reset-password` and `/auth/sign-out`. It verifies Supabase sessions on the server; the old ChatGPT identity headers are not accepted as proof of login. [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side/nextjs) · [Redirect URL settings](https://supabase.com/docs/guides/auth/redirect-urls)

For local development, use a separate Supabase project and `APP_URL=http://127.0.0.1:5173`. Add the matching local callback URLs to that project's allowlist. Production should use only the intended HTTPS origins.

## 7. Make your account an administrator

1. Register on the deployed site, open the confirmation email, and sign in.
2. In Supabase **Authentication → Users**, find your account and copy its user UUID. This is also the `user.id` shown by `/api/bootstrap` while you are signed in.
3. Put that UUID into Render's `ADMIN_USER_IDS`. For several trusted administrators, separate their UUIDs with commas. Save and redeploy.
4. Sign in again and confirm that **Review listings** appears. An ordinary account must not have this access.

Every successful registration has a real account in **Authentication → Users**. Marketplace records are in the `parksarthi` database schema; uploaded files are in Storage. Visitor analytics is a separate unfinished feature, so a visit without signup does not appear as a registered user.

## 8. Check the deployed service

Using two accounts you control, verify:

- Signup, email confirmation, sign-in, password recovery and sign-out work, and sessions remain separate between accounts.
- The empty catalogue contains no fictional listings or bookings.
- A host can upload their own parking photo and submit a real space; it stays hidden from search until an administrator approves it.
- Another account cannot edit the host's space or read an unpublished photo.
- Approved listings remain after a Render restart/redeploy; photos still load from Supabase.
- Booking stays unavailable while payment mode is disabled. No success message pretends that a space was reserved or money was transferred.

Use genuine listings on the customer service. Use isolated test infrastructure for synthetic records and provider transaction testing. Keep real charging disabled until [LAUNCH-GUIDE.md](./LAUNCH-GUIDE.md) is completed. A working Render deployment does not activate Razorpay or build automatic host payouts.

## Existing Cloudflare/Sites data

This is a new database and auth system. The code push does not copy old D1 records, R2 photos or Sites identities. If any genuine hosts, bookings or uploads exist in the old service, export and reconcile them before switching traffic: map old account IDs to the correct Supabase user UUIDs, migrate only the intended real records, copy the corresponding photos, and verify ownership. Do not guess an identity match or silently transfer records to a new user. Keep the old service and its data available until that migration is checked.
