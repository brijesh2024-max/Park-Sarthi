# ParkSaathi: from private pilot to real bookings

Prepared 26 October 2026. This release is a private pilot with ChatGPT sign-in and clearly labelled sample spaces. `PAYMENT_MODE=demo` is the default. Demo bookings are simulations: they do not reserve property, charge drivers, or pay hosts. Keep it this way until the checks below pass.

## What this release covers

The app provides multi-city discovery, car/bike/SUV filters, optional washing, booking and host dashboards, listing review, D1 database records, and R2 photo storage. The payment integration is designed around Razorpay orders, server verification, and webhooks. Code being present does not mean a payment account is activated or a real payment has been tested.

| Area | Owner action or remaining work |
| --- | --- |
| Hosting, database, files | The Sites manifest declares the Worker, D1 `DB`, and R2 `BUCKET`. Confirm successful deployment and persistence in the hosted pilot. Local preview data is separate. |
| Sign-in | Pilot uses ChatGPT sign-in. Decide whether that is suitable for your customers before a public launch; ordinary phone OTP sign-in is not included. |
| Administration | Set your stable Site user ID in `ADMIN_USER_IDS`. No user becomes an admin automatically. |
| Driver payment | Supply matching test credentials, verify the complete payment lifecycle, then complete provider activation before live mode. |
| Host earnings | Automatic linked-account onboarding, split transfers, settlement reconciliation, and payout reporting are not part of this release. A host dashboard amount is not a bank payout. |
| Host availability | Capacity, daily opening hours, and blocked dates are enforced. Hours and dates are set when creating a listing; editing schedules and recurring weekly calendars require further work. |
| Operations | Host verification, customer support, policies, insurance arrangements, and incident response need an actual business process. |

## Your first setup steps

1. Test the private app with sample spaces. Change cities, book with and without a wash, cancel a booking, submit a host listing and upload a photo. Reload and sign in again to check persistence.
2. While signed in, open `/api/bootstrap` and find your `user.id`. Configure that exact ID in the hosted `ADMIN_USER_IDS` environment variable, then redeploy. Add further trusted admins only by their own stable IDs. Do not use an email address or a browser-supplied role.
3. Review a submitted listing as admin. Test that another account cannot see private bookings, edit another host's space, or access unpublished photos. A listing approval records your review; it is not a physical security guarantee.
4. Choose the business/operator identity, support email and phone, domain, and initial launch neighbourhoods. The software supports multiple cities; start actual operations only where you can verify and support hosts.
5. Create your payment-provider account yourself and complete its requested business verification. Do not send passwords, API secrets, bank details, or identity documents in chat. Enter credentials through the provider and hosted secret settings.

## Connect and test payments

The configuration keys are listed in `.env.example`. Hosted runtime settings are separate from local files and the hosting manifest. A new deployment is required after changing hosted values. Keep `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` server-only; the Checkout key ID is intentionally available to the client.

Use `PAYMENT_MODE=test` with a matching Razorpay test key pair. Create a genuine test listing through the host/admin flow; the sample catalogue remains demonstrative. Confirm automatic capture settings in the provider dashboard. Razorpay requires a server-created order, server-side signature validation using the stored order ID, and payment-status verification. A browser success message alone is insufficient. [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)

Configure `/api/payments/webhook` on the deployed origin in the Razorpay test dashboard, with the same distinct webhook secret as the server. Subscribe to `payment.captured`, `order.paid`, `refund.processed`, and `refund.failed`. The endpoint must be reachable by Razorpay: a private Site's sign-in gate can reject the request before the handler runs. Resolve this through an approved public ingress or an explicitly authorised public launch; do not put a Site access token in a URL or weaken access controls just to bypass the gate.

Verify webhook signatures over the raw request body, duplicate-event handling, and out-of-order delivery. Use a staging endpoint reachable from the provider and inspect actual delivery results. [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/)

Before live payments, record successful tests for:

- Correct INR amount and fee, with and without washing; server rejection of altered client prices.
- Successful payment, declined payment, closed Checkout, refresh during payment, and lost browser callback.
- Two drivers attempting the final space, expired payment holds, and a late payment after a hold expires.
- Duplicate callbacks/webhooks, invalid signatures, wrong booking/order IDs, and cross-account access attempts.
- Cancellation and refund reconciliation, including a failed or delayed refund. Keep `refund_pending` distinct from money returned.

Investigate every mismatch between bookings and the provider dashboard. Use provider transaction IDs as the reconciliation reference. The app requests refunds through the server and retains `refund_pending` until processing is verified. An ambiguous provider failure needs manual reconciliation before retrying, to avoid a duplicate refund. Define who handles these cases; the dashboard can issue and inspect refunds, but a request is not proof that the customer's bank has credited it. [Razorpay payment dashboard actions](https://razorpay.com/docs/payments/payments/dashboard/)

## Set up host payments separately

Tell the provider exactly how ParkSaathi works: drivers pay for independent hosts' spaces, the platform collects a fee, and hosts receive their share. Ask for written confirmation of the supported marketplace fund flow and your eligibility before accepting money on hosts' behalf.

Razorpay Route supports splitting funds to linked accounts, settlement controls, and transfer reversals, but its current documentation includes eligibility and compliance conditions. Do not assume a new business qualifies or that a standard Payment Gateway account authorises this model. If Route is unavailable, ask the provider for an approved alternative before implementing it. [Route overview and eligibility](https://razorpay.com/docs/payments/route/)

After approval, the next engineering work is host linked-account onboarding and status, bank/KYC handling through the provider, an earnings ledger, transfer creation, refund/transfer reversals, settlement webhooks, and reconciliation. Decide the settlement delay and who bears cancellations or disputes. Test with the provider's supported sandbox process. [Linked accounts](https://razorpay.com/docs/payments/route/linked-account) and [Route integration](https://razorpay.com/docs/payments/route/integration-guide)

## Verify spaces and publish clear policies

For each host, verify identity and authority to offer the specific space. Check access hours, actual capacity, dimensions and height clearance, entry instructions, lighting, obstruction risk, and evidence for claimed CCTV or attendant facilities. Confirm the configured opening hours and blocked dates match the host's availability. Schedule changes require pausing the listing and an operator review that protects existing bookings. Confirm any landlord, building, society, or local authority permission that applies. Inspect wash facilities and agree on what the wash includes. Avoid advertising any roadside or unauthorised area as rentable private parking.

Have a local lawyer and accountant review the operating model in each launch area: land use and parking permissions, host agreements, liability and insurance, consumer terms, cancellation/no-show/refund rules, tax treatment and invoices, platform fees, and complaint handling. These are review topics, not a claim that one national checklist establishes compliance.

Prepare a privacy notice covering account data, vehicle registration, booking history, location/address data, photos, payment references, processors, retention and deletion, and a contact for requests. Collect only necessary information; do not store payment-card data or upload KYC documents to the ordinary listing-photo bucket. Ask counsel which DPDP provisions and commencement dates apply to the launch. [MeitY's official rules, corrigendum, and enforcement timeline](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025%3B)

## Operational launch gate

Live payments require both `PAYMENT_MODE=live` and `LIVE_PAYMENTS_ENABLED=true`, plus a complete matching credential set. Before enabling them or changing the audience to public, confirm:

- A payment provider has approved the business and host settlement model; payments, refunds, and external webhooks pass staging tests.
- Real host listings have been reviewed, support contacts are staffed, and drivers can report access problems or damage.
- Terms, privacy, cancellation/refund policies and fee disclosure reflect the actual service. Do not claim insurance, verified safety, or guaranteed protection without the corresponding arrangements.
- An engineer has reviewed authorization, request throttling, upload handling, data exposure, logs, dependencies, and failure recovery. Automated rate limiting and abuse operations need their own production review.
- Database recovery/export options and photo backups are confirmed for the hosting account, with a tested restore process and retention policy. Source code versioning is not a database backup.
- Alerts cover application failures, payment/webhook failures, unresolved refunds and settlement discrepancies. Assign an operator to reconcile them daily during the pilot.

Public launch, a custom domain, and live credentials are explicit later steps. Keeping the first pilot private lets you review the full experience without offering sample inventory to real drivers.
