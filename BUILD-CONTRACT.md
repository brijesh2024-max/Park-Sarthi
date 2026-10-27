# Current implementation contract

Updated 27 October 2026. This replaces the initial demo build brief.

- Search returns only approved rows from the listings database; no sample catalogue or stock property photos.
- Bootstrap returns user, isAdmin, bookingsEnabled, cities and listings.
- Customer booking requires a live key pair, webhook secret, PAYMENT_MODE=live and LIVE_PAYMENTS_ENABLED=true. Missing setup returns an unavailable response; test mode never creates a customer reservation.
- Server-calculated prices, temporary holds, captured-payment verification, atomic capacity checks and refund reconciliation remain mandatory.
- Driver, host and admin booking queries return live-payment records only. Legacy demo/test records are retained without being presented as real activity.
- The host dashboard refreshes guest bookings every 30 seconds while visible, on focus and on demand.
- Test fixtures belong only in tests/ and isolated local test storage.
- Listings require host-owned photo uploads, permission confirmation and administrator approval.
- Automatic host payouts, customer reviews, visitor analytics and standalone user registration are still separate unfinished work.
- Preserve the private Sites audience until explicitly changed. Render migration remains outstanding.
