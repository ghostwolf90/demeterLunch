CREATE TABLE `town_map_previews` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`manifest_json` text NOT NULL,
	`focus_city` text NOT NULL,
	`focus_district` text NOT NULL,
	`focus_placement_id` text,
	`actor_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `town_map_previews_expires_at_idx` ON `town_map_previews` (`expires_at`);