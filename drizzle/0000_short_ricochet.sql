CREATE TABLE `official_meal_records` (
	`school_id` integer NOT NULL,
	`meal_date` text NOT NULL,
	`status` text NOT NULL,
	`content_hash` text NOT NULL,
	`fetched_at` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`source_url` text NOT NULL,
	`r2_key` text NOT NULL,
	`record_json` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`school_id`, `meal_date`)
);
--> statement-breakpoint
CREATE INDEX `official_meal_records_date_idx` ON `official_meal_records` (`meal_date`);--> statement-breakpoint
CREATE TABLE `refresh_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_key` text NOT NULL,
	`meal_date` text NOT NULL,
	`school_id` integer NOT NULL,
	`status` text NOT NULL,
	`save_status` text NOT NULL,
	`error` text,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `refresh_attempts_job_idx` ON `refresh_attempts` (`job_key`,`id`);--> statement-breakpoint
CREATE INDEX `refresh_attempts_retry_idx` ON `refresh_attempts` (`meal_date`,`school_id`,`id`);--> statement-breakpoint
CREATE TABLE `refresh_jobs` (
	`job_key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`meal_date` text NOT NULL,
	`group_id` integer,
	`cursor` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`status` text NOT NULL,
	`school_ids_json` text,
	`available_count` integer DEFAULT 0 NOT NULL,
	`no_meal_count` integer DEFAULT 0 NOT NULL,
	`not_published_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `refresh_jobs_date_idx` ON `refresh_jobs` (`meal_date`);--> statement-breakpoint
CREATE TABLE `refresh_locks` (
	`lock_name` text PRIMARY KEY NOT NULL,
	`owner_token` text,
	`lease_until` text,
	`updated_at` text NOT NULL
);
