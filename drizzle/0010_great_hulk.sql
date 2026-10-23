ALTER TABLE `child_profiles` ADD `name` text;--> statement-breakpoint
ALTER TABLE `child_profiles` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `nickname` text;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `subscription_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `subscription_period_end` text;--> statement-breakpoint
ALTER TABLE `parent_accounts` ADD `subscription_cancel_at_period_end` integer DEFAULT false NOT NULL;