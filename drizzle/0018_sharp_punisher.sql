CREATE TABLE `town_coin_ledger` (
	`auth_user_id` text NOT NULL,
	`ledger_key` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`auth_user_id`, `ledger_key`),
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `town_coin_ledger_owner_idx` ON `town_coin_ledger` (`auth_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `town_daily_quest_events` (
	`auth_user_id` text NOT NULL,
	`event_key` text NOT NULL,
	`task_date` text NOT NULL,
	`event_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`value` integer DEFAULT 1 NOT NULL,
	`occurred_at` text NOT NULL,
	PRIMARY KEY(`auth_user_id`, `event_key`),
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `town_daily_quest_events_progress_idx` ON `town_daily_quest_events` (`auth_user_id`,`task_date`,`event_type`);--> statement-breakpoint
CREATE TABLE `town_daily_quest_overrides` (
	`auth_user_id` text NOT NULL,
	`task_date` text NOT NULL,
	`category` text NOT NULL,
	`task_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`auth_user_id`, `task_date`),
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
