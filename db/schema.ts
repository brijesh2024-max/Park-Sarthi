import { pgSchema, text, integer, doublePrecision, index, uniqueIndex } from "drizzle-orm/pg-core";
const marketplace = pgSchema("parksarthi");
export const listings = marketplace.table("listings", {
  id: text("id").primaryKey(), hostId: text("host_id").notNull(), title: text("title").notNull(),
  city: text("city").notNull(), area: text("area").notNull(), address: text("address").notNull(), description: text("description").notNull(),
  vehicleTypes: text("vehicle_types").notNull(), pricePerHour: integer("price_per_hour").notNull(), washPrice: integer("wash_price"),
  capacity: integer("capacity").notNull(), amenities: text("amenities").notNull(), imageUrl: text("image_url").notNull(),
  lat: doublePrecision("lat").notNull(), lng: doublePrecision("lng").notNull(), status: text("status").notNull().default("pending"),
  openingTime:text("opening_time").notNull().default("00:00"), closingTime:text("closing_time").notNull().default("00:00"), blockedDates:text("blocked_dates").notNull().default("[]"),
  rightsConfirmedAt: text("rights_confirmed_at").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("listings_host_idx").on(t.hostId), index("listings_status_city_idx").on(t.status,t.city)]);
export const bookings = marketplace.table("bookings", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), hostId: text("host_id").notNull(), listingId: text("listing_id").notNull(), snapshot: text("snapshot").notNull(),
  startAt: text("start_at").notNull(), endAt: text("end_at").notNull(), vehicleType: text("vehicle_type").notNull(), vehicleNumber: text("vehicle_number").notNull(),
  addWash: integer("add_wash").notNull().default(0), parkingAmount: integer("parking_amount").notNull(), washAmount: integer("wash_amount").notNull(),
  feeAmount: integer("fee_amount").notNull(), totalAmount: integer("total_amount").notNull(), status: text("status").notNull(), paymentMode: text("payment_mode").notNull(),
  createdAt: text("created_at").notNull(), expiresAt: text("expires_at"), orderId: text("order_id"), paymentId: text("payment_id"),
  refundId: text("refund_id"), refundState: text("refund_state"), checkInCode: text("check_in_code").notNull(),
}, t => [index("bookings_user_idx").on(t.userId), index("bookings_host_idx").on(t.hostId), index("bookings_availability_idx").on(t.listingId,t.status,t.startAt,t.endAt), uniqueIndex("bookings_order_unique").on(t.orderId), uniqueIndex("bookings_payment_unique").on(t.paymentId)]);
export const photos = marketplace.table("photos", { key:text("key").primaryKey(), ownerId:text("owner_id").notNull(), mime:text("mime").notNull(), size:integer("size").notNull(), createdAt:text("created_at").notNull() }, t=>[index("photos_owner_idx").on(t.ownerId)]);
export const rateLimits = marketplace.table("rate_limits", { key:text("key").primaryKey(), windowStart:integer("window_start").notNull(), count:integer("count").notNull() });
export const paymentEvents = marketplace.table("payment_events", { id:text("id").primaryKey(), eventType:text("event_type").notNull(), processedAt:text("processed_at").notNull() });
export const auditLog = marketplace.table("audit_log", { id:text("id").primaryKey(), actorId:text("actor_id").notNull(), action:text("action").notNull(), targetId:text("target_id").notNull(), createdAt:text("created_at").notNull() });
