CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`host_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`vehicle_type` text NOT NULL,
	`vehicle_number` text NOT NULL,
	`add_wash` integer DEFAULT 0 NOT NULL,
	`parking_amount` integer NOT NULL,
	`wash_amount` integer NOT NULL,
	`fee_amount` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`status` text NOT NULL,
	`payment_mode` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text,
	`order_id` text,
	`payment_id` text,
	`refund_id` text,
	`refund_state` text,
	`check_in_code` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bookings_user_idx` ON `bookings` (`user_id`);--> statement-breakpoint
CREATE INDEX `bookings_host_idx` ON `bookings` (`host_id`);--> statement-breakpoint
CREATE INDEX `bookings_availability_idx` ON `bookings` (`listing_id`,`status`,`start_at`,`end_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_order_unique` ON `bookings` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_payment_unique` ON `bookings` (`payment_id`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`title` text NOT NULL,
	`city` text NOT NULL,
	`area` text NOT NULL,
	`address` text NOT NULL,
	`description` text NOT NULL,
	`vehicle_types` text NOT NULL,
	`price_per_hour` integer NOT NULL,
	`wash_price` integer,
	`capacity` integer NOT NULL,
	`amenities` text NOT NULL,
	`image_url` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`rights_confirmed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listings_host_idx` ON `listings` (`host_id`);--> statement-breakpoint
CREATE INDEX `listings_status_city_idx` ON `listings` (`status`,`city`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`key` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_owner_idx` ON `photos` (`owner_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
