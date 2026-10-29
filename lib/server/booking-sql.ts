// Run creation and confirmation inside Database.withListingLock(listingId, ...).
// The row lock serializes writers across Render instances. Each statement then
// sees the previous writer's committed reservations in READ COMMITTED isolation.
// Evaluate occupancy at each interval boundary so consecutive reservations do
// not incorrectly consume two spaces for the whole requested interval.
export const CREATE_BOOKING_SQL = `
WITH request AS (
 SELECT CAST(? AS text) AS listing_id, CAST(? AS text) AS start_at,
        CAST(? AS text) AS end_at, CAST(? AS text) AS now,
        CAST(? AS integer) AS quoted_capacity, CAST(? AS text) AS user_id,
        CAST(? AS text) AS vehicle_number
), candidate AS (
 SELECT r.listing_id,r.start_at,r.end_at,r.now,r.user_id,r.vehicle_number,l.capacity
 FROM request r JOIN listings l ON l.id = r.listing_id AND l.status = 'active'
), occupied AS (
 SELECT b.start_at,b.end_at FROM bookings b,candidate c
 WHERE b.payment_mode = 'live' AND b.listing_id = c.listing_id AND b.start_at < c.end_at AND b.end_at > c.start_at
 AND (b.status = 'confirmed' OR (b.status = 'pending_payment' AND b.expires_at > c.now))
), boundaries AS (
 SELECT start_at AS t FROM candidate
 UNION SELECT start_at AS t FROM occupied WHERE start_at > (SELECT start_at FROM candidate)
)
INSERT INTO bookings (id,user_id,host_id,listing_id,snapshot,start_at,end_at,vehicle_type,vehicle_number,add_wash,parking_amount,wash_amount,fee_amount,total_amount,status,payment_mode,created_at,expires_at,check_in_code)
SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
WHERE EXISTS (SELECT 1 FROM listings l,candidate c WHERE l.id = c.listing_id AND l.status = 'active')
 AND NOT EXISTS (SELECT 1 FROM boundaries t,candidate c WHERE
  (SELECT COUNT(*) FROM occupied o WHERE o.start_at <= t.t AND o.end_at > t.t) >= c.capacity)
AND NOT EXISTS (SELECT 1 FROM bookings b,candidate c
 WHERE b.user_id = c.user_id AND b.listing_id = c.listing_id AND b.start_at = c.start_at
 AND b.end_at = c.end_at AND b.vehicle_number = c.vehicle_number
 AND b.payment_mode = 'live' AND (b.status = 'confirmed' OR (b.status = 'pending_payment' AND b.expires_at > c.now)))
RETURNING id`;

export const CONFIRM_BOOKING_SQL = `
WITH candidate AS (
 SELECT b.id,b.listing_id,b.start_at,b.end_at,l.capacity,l.status AS listing_status
 FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.id = ?
), occupied AS (
 SELECT b.start_at,b.end_at FROM bookings b,candidate c
 WHERE b.payment_mode = 'live' AND b.listing_id = c.listing_id AND b.id != c.id
 AND b.start_at < c.end_at AND b.end_at > c.start_at
 AND (b.status = 'confirmed' OR (b.status = 'pending_payment' AND b.expires_at > ?))
), boundaries AS (
 SELECT start_at AS t FROM candidate
 UNION SELECT start_at AS t FROM occupied WHERE start_at > (SELECT start_at FROM candidate)
)
UPDATE bookings SET status = 'confirmed',payment_id = ?
WHERE id = (SELECT id FROM candidate) AND payment_mode = 'live' AND status = 'pending_payment' AND start_at > ?
AND (SELECT listing_status FROM candidate) = 'active'
AND NOT EXISTS (SELECT 1 FROM boundaries t,candidate c WHERE
 (SELECT COUNT(*) FROM occupied o WHERE o.start_at <= t.t AND o.end_at > t.t) >= c.capacity)
RETURNING id`;

export const RECONCILE_FULL_REFUND_SQL = `UPDATE bookings SET status = 'refunded',refund_state = 'processed',refund_id = ?
 WHERE id = ? AND payment_mode = 'live' AND status != 'refunded'`;
