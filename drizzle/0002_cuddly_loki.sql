CREATE TABLE `child_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_user_id` text NOT NULL,
	`nickname` text NOT NULL,
	`grade_group` text NOT NULL,
	`school_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_profiles_owner_idx` ON `child_profiles` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `food_encounters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`auth_user_id` text NOT NULL,
	`meal_date` text NOT NULL,
	`food_name` text NOT NULL,
	`experience` text NOT NULL,
	`preparation` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `food_encounters_owner_idx` ON `food_encounters` (`auth_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `food_encounters_child_idx` ON `food_encounters` (`child_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `parent_accounts` (
	`auth_user_id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
