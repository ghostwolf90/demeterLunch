CREATE TABLE `account_identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`provider`, `subject`),
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_identities_owner_provider_idx` ON `account_identities` (`auth_user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `oauth_challenges` (
	`state_digest` text PRIMARY KEY NOT NULL,
	`browser_digest` text NOT NULL,
	`nonce` text NOT NULL,
	`code_verifier` text NOT NULL,
	`auth_user_id` text,
	`session_digest` text,
	`eligibility_confirmed_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `parent_accounts`(`auth_user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_challenges_expiry_idx` ON `oauth_challenges` (`expires_at`);