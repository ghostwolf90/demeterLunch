CREATE TABLE `telegram_notifications` (
	`event_key` text PRIMARY KEY NOT NULL,
	`job_key` text,
	`meal_date` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`telegram_message_id` integer,
	`last_error` text,
	`created_at` text NOT NULL,
	`sent_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `telegram_notifications_date_idx` ON `telegram_notifications` (`meal_date`,`event_type`);--> statement-breakpoint
CREATE INDEX `telegram_notifications_job_idx` ON `telegram_notifications` (`job_key`);