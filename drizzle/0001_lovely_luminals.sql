ALTER TABLE `listings` ADD `opening_time` text DEFAULT '00:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `closing_time` text DEFAULT '00:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `blocked_dates` text DEFAULT '[]' NOT NULL;