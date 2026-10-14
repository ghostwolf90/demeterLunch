CREATE TABLE `account_sessions` (
	`token_digest` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_sessions_owner_idx` ON `account_sessions` (`auth_user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `account_sessions_expiry_idx` ON `account_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `email_auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code_digest` text NOT NULL,
	`request_key` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`eligibility_confirmed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text
);
--> statement-breakpoint
CREATE INDEX `email_auth_challenges_email_idx` ON `email_auth_challenges` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_auth_challenges_expiry_idx` ON `email_auth_challenges` (`expires_at`);--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `email_normalized` text;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `adult_verified_at` text;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `caregiver_confirmed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `parent_accounts_email_normalized_idx` ON `parent_accounts` (`email_normalized`);