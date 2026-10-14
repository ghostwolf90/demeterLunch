ALTER TABLE `food_encounters` ADD `school_id` integer;--> statement-breakpoint
ALTER TABLE `food_encounters` ADD `meal_type` text DEFAULT 'meat' NOT NULL;