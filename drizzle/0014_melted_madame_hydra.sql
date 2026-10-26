CREATE TABLE `maintenance_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`severity` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
