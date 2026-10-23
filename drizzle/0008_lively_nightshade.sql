DROP INDEX `child_profiles_owner_idx`;--> statement-breakpoint
CREATE INDEX `child_profiles_owner_idx` ON `child_profiles` (`auth_user_id`,`id`);