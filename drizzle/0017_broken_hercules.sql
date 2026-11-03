CREATE TABLE `town_achievement_events` (
	`auth_user_id` text NOT NULL,
	`event_key` text NOT NULL,
	`city` text NOT NULL,
	`event_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	PRIMARY KEY(`auth_user_id`, `event_key`),
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `town_achievement_events_progress_idx` ON `town_achievement_events` (`auth_user_id`,`city`,`event_type`);--> statement-breakpoint
CREATE TABLE `town_achievement_unlocks` (
	`auth_user_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` text NOT NULL,
	PRIMARY KEY(`auth_user_id`, `achievement_id`),
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `town_achievement_unlocks_owner_idx` ON `town_achievement_unlocks` (`auth_user_id`,`unlocked_at`);
