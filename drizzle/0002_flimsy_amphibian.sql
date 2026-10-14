CREATE TABLE `research_export_attempts` (
	`actor_hash` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`blocked_until` integer,
	`updated_at` integer NOT NULL
);
