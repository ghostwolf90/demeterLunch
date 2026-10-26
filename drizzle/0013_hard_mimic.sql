ALTER TABLE `email_auth_challenges` ADD `auth_user_id` text REFERENCES parent_accounts(auth_user_id);--> statement-breakpoint
ALTER TABLE `email_auth_challenges` ADD `session_digest` text;