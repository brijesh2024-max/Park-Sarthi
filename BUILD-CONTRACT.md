# ParkSaathi implementation contract

Multi-city Indian parking marketplace. Owner private pilot; hosted ChatGPT identity; D1 records; R2 listing photos. Demo fixtures are always clearly labelled and never represent actual reservable property. No real charges without configured Razorpay keys. Prices stored as integer paise. Dates use ISO UTC over API; display Asia/Kolkata. Cities: Delhi, Mumbai, Bengaluru, Hyderabad, Pune, Chennai, Gurugram, Noida.

## Files / ownership
- UI agent: app/page.tsx, app/marketplace.tsx, app/globals.css, app/layout.tsx, public visual assets only.
- Backend agent: app/api/**, lib/marketplace.ts (shared types + fixtures + pure validation/pricing), lib/server/**, db/schema.ts, cloudflare-env.d.ts, tests backend logic. Do not change package inputs while installer runs.
- Root: manifest, migration generation/build/deployment/integration fixes/docs.

## API contract
All JSON errors `{error: string}` with meaningful 4xx/5xx. GET /api/bootstrap returns `{user: {id,name,email}|null, isAdmin:boolean, paymentMode:'demo'|'test'|'live', cities:string[], listings:Listing[]}`. GET /api/listings returns `{listings:Listing[]}` (active real + fixed demo catalogue). Filters client side initially. GET /api/account returns `{bookings:Booking[], listings:Listing[], hostBookings:Booking[]}`; requires identity.

Listing `{id,hostId,title,city,area,address,description,vehicleTypes:('car'|'bike'|'suv')[],pricePerHour:number,washPrice:number|null,capacity:number,amenities:string[],imageUrl:string,lat:number,lng:number,status:'draft'|'pending'|'active'|'rejected',demo:boolean}`. Prices in paise. Public listing address must be approximate area; exact real address only in owner data or confirmed booking. Fixtures use local image paths supplied by root/UI or images.unsplash.com photo URLs.

Booking `{id,listingId,listingTitle,city,area,imageUrl,startAt,endAt,vehicleType,vehicleNumber,addWash,parkingAmount,washAmount,feeAmount,totalAmount,status:'demo'|'pending_payment'|'confirmed'|'cancelled'|'refund_pending'|'refunded'|'expired',createdAt,checkInCode?:string,address?:string}`. No fake completed history or ratings. Demo bookings persist in DB, are explicit simulations, and may be cancelled.

POST /api/bookings body `{listingId,startAt,endAt,vehicleType,vehicleNumber,addWash}` returns `{booking, checkout?:{keyId,orderId,amount,currency:'INR'}}`. Server authorizes, validates, computes fee (10%), checks vehicle types and wash availability. Demo sample booking works when signed in and paymentMode demo. Real listings cannot be charged/reserved in demo mode. Atomic DB capacity checks prevent double booking. Enforce booking length max 7 days, future start; meaningful errors. A real pending payment hold expires 10 minutes after creation. Razorpay order + payment verification code and webhook HMAC, explicit test/live selection. POST /api/payments/verify body `{bookingId,razorpay_order_id,razorpay_payment_id,razorpay_signature}`. POST /api/bookings/[id]/cancel. GET/POST API ownership everywhere.

POST /api/listings body `{title,city,area,address,description,vehicleTypes,pricePerHour,washPrice,capacity,amenities,imageUrl,lat,lng}` creates pending listing. All host info validated, property rights acknowledgement required in UI (backend field `rightsConfirmed:true`). PATCH /api/listings/[id] for owner pause/resubmit via `{status:'draft'|'pending'}`. POST /api/uploads form field `file` returns `{url}` for authenticated owner, raster image signature/type/size validation max 5 MB, own R2 key. GET /api/photos/[...key] serves authorized or approved listing imagery. Admin identified only by ADMIN_USER_IDS environment allowlist; GET /api/admin returns `{listings,bookings}` and PATCH /api/admin/listings/[id] `{status:'active'|'rejected'}`. No bootstrap-first-user admin.

## UX
One polished responsive marketplace with nav Find parking / My bookings / Host dashboard, List your space CTA, account sign-in. Hero + practical location/date/time/vehicle search; search result grid, city/amenity/car wash filters, price sorting, map/list toggle or schematic map honestly labelled. Listing detail modal with booking quote (not authoritative), parking duration, vehicle plate, wash add-on, transparent fee and demo checkout. Booking view, host dashboard with form, photo upload, pending review / pause controls; admin view if allowed. Clear empty/error/loading/success states. Accessibility: real form labels, keyboard dialog close, focus handling, mobile navigation. No fictitious review/verification counts. Local photo assets or reliable remote photos with fallback.

## Environment
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, PAYMENT_MODE (demo default / test / live), ADMIN_USER_IDS comma-separated stable Site user IDs. Runtime secrets only, not source or manifest. Live enabling requires host payout/operational readiness; report limitations honestly. Preserve Sites starter integration.
