CREATE TABLE `town_map_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`manifest_json` text NOT NULL,
	`summary_json` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `town_map_revisions_action_idx` ON `town_map_revisions` (`action`,`id`);
