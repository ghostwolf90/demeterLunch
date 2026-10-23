ALTER TABLE `parent_accounts` ADD `onboarding_status` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `onboarding_started_at` text;