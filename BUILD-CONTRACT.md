# Current implementation contract

Updated 28 October 2026 for the Render/Supabase migration.

- Next.js runs as a Node.js web service. PostgreSQL, authentication and private photo storage are provided by Supabase.
- Authentication verifies a real Supabase session. Arbitrary ChatGPT identity headers cannot authenticate a user.
- Email registration collects name, email, password and mobile number and requires an email OTP. Existing accounts support password, Google and email OTP login. Google uses its verified email followed by profile completion. Mobile is contact information, not an SMS-verified identity. Administrator IDs are Supabase user UUIDs.
- Search returns approved database listings only. Empty means empty; no synthetic inventory, reviews or transaction history may be appended.
- Customer booking requires live Razorpay keys, a webhook secret, PAYMENT_MODE=live and LIVE_PAYMENTS_ENABLED=true. Disabled or test mode never creates a customer reservation.
- Server-calculated prices, temporary holds, captured-payment verification, transaction-protected capacity checks and refund reconciliation remain mandatory.
- PostgreSQL reservation creation/confirmation must lock the listing row in the same transaction as the availability query/write. Separate reads and writes are insufficient.
- User, host and administrator dashboards show live-payment records only. The host dashboard refreshes bookings while visible, on focus and on demand.
- Photos use a private Supabase bucket and are served only through an authorized application endpoint. The service-role key is server-only.
- Test fixtures belong only in automated tests and isolated test projects, never the customer catalogue.
- Automated host payouts, customer reviews, visitor analytics, phone OTP and ongoing operational support remain separate work.
- Old Sites D1/R2 data and account identities are not automatically migrated. Switching genuine existing records requires checked identity and ownership mapping.
- A successful build is not proof of successful provider setup or live payment operation. Follow RENDER-SETUP.md and LAUNCH-GUIDE.md.
