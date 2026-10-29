-- Apply to the Supabase SQL editor as the project database owner.
-- This is a new PostgreSQL schema, not an automatic import of earlier D1 data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS parksarthi;
REVOKE ALL ON SCHEMA parksarthi FROM PUBLIC;

CREATE TABLE IF NOT EXISTS parksarthi.listings (
 id text PRIMARY KEY, host_id text NOT NULL, title text NOT NULL,
 city text NOT NULL, area text NOT NULL, address text NOT NULL, description text NOT NULL,
 vehicle_types text NOT NULL CHECK (jsonb_typeof(vehicle_types::jsonb) = 'array'),
 price_per_hour integer NOT NULL CHECK (price_per_hour BETWEEN 1000 AND 200000),
 wash_price integer CHECK (wash_price BETWEEN 1000 AND 500000),
 capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100),
 amenities text NOT NULL CHECK (jsonb_typeof(amenities::jsonb) = 'array'),
 image_url text NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','active','rejected')),
 opening_time text NOT NULL DEFAULT '00:00', closing_time text NOT NULL DEFAULT '00:00',
 blocked_dates text NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(blocked_dates::jsonb) = 'array'),
 rights_confirmed_at text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS listings_host_idx ON parksarthi.listings(host_id);
CREATE INDEX IF NOT EXISTS listings_status_city_idx ON parksarthi.listings(status,city);

CREATE TABLE IF NOT EXISTS parksarthi.bookings (
 id text PRIMARY KEY, user_id text NOT NULL, host_id text NOT NULL,
 listing_id text NOT NULL REFERENCES parksarthi.listings(id) ON DELETE RESTRICT,
 snapshot text NOT NULL CHECK (jsonb_typeof(snapshot::jsonb) = 'object'),
 start_at text NOT NULL, end_at text NOT NULL CHECK (end_at > start_at),
 vehicle_type text NOT NULL CHECK (vehicle_type IN ('car','bike','suv')), vehicle_number text NOT NULL,
 add_wash integer NOT NULL DEFAULT 0 CHECK (add_wash IN (0,1)),
 parking_amount integer NOT NULL CHECK (parking_amount >= 0), wash_amount integer NOT NULL CHECK (wash_amount >= 0),
 fee_amount integer NOT NULL CHECK (fee_amount >= 0), total_amount integer NOT NULL CHECK (total_amount = parking_amount + wash_amount + fee_amount),
 status text NOT NULL CHECK (status IN ('demo','pending_payment','confirmed','cancelled','refund_pending','refunded','expired')),
 payment_mode text NOT NULL CHECK (payment_mode IN ('demo','test','live')),
 created_at text NOT NULL, expires_at text, order_id text UNIQUE, payment_id text UNIQUE,
 refund_id text, refund_state text, check_in_code text NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON parksarthi.bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_host_idx ON parksarthi.bookings(host_id);
CREATE INDEX IF NOT EXISTS bookings_availability_idx ON parksarthi.bookings(listing_id,status,start_at,end_at)
 WHERE payment_mode = 'live' AND status IN ('confirmed','pending_payment');

CREATE TABLE IF NOT EXISTS parksarthi.photos (
 key text PRIMARY KEY, owner_id text NOT NULL,
 mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
 size integer NOT NULL CHECK (size > 0 AND size <= 5242880), created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_owner_idx ON parksarthi.photos(owner_id);
CREATE TABLE IF NOT EXISTS parksarthi.rate_limits (
 key text PRIMARY KEY, window_start integer NOT NULL, count integer NOT NULL
);
CREATE TABLE IF NOT EXISTS parksarthi.payment_events (
 id text PRIMARY KEY, event_type text NOT NULL, processed_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS parksarthi.audit_log (
 id text PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, target_id text NOT NULL, created_at text NOT NULL
);

-- The Render server connects directly. Supabase Data API users receive no access.
ALTER TABLE parksarthi.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE parksarthi.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE parksarthi.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parksarthi.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE parksarthi.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE parksarthi.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA parksarthi FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA parksarthi FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA parksarthi REVOKE ALL ON TABLES FROM PUBLIC;
DO $permissions$
BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON SCHEMA parksarthi FROM anon;
  REVOKE ALL ON ALL TABLES IN SCHEMA parksarthi FROM anon;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA parksarthi FROM anon;
  ALTER DEFAULT PRIVILEGES IN SCHEMA parksarthi REVOKE ALL ON TABLES FROM anon;
 END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
  REVOKE ALL ON SCHEMA parksarthi FROM authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA parksarthi FROM authenticated;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA parksarthi FROM authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA parksarthi REVOKE ALL ON TABLES FROM authenticated;
 END IF;
END;
$permissions$;
COMMIT;
