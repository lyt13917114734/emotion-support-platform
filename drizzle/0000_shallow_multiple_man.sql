CREATE TABLE `experiment_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`resume_token_hash` text NOT NULL,
	`sequence` text NOT NULL,
	`seed` integer NOT NULL,
	`protocol_version` text NOT NULL,
	`material_version` text NOT NULL,
	`measure_version` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`profile_json` text NOT NULL,
	`session_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	`withdrawn_at` integer,
	CONSTRAINT "experiment_sessions_sequence_check" CHECK("experiment_sessions"."sequence" in ('AX_BY','AY_BX','BX_AY','BY_AX')),
	CONSTRAINT "experiment_sessions_status_check" CHECK("experiment_sessions"."status" in ('active','completed','withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_sessions_participant_id_unique` ON `experiment_sessions` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_experiment_sessions_status_updated` ON `experiment_sessions` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `participant_codes` (
	`participant_id` text PRIMARY KEY NOT NULL,
	`sequence` text NOT NULL,
	`seed` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`claimed_session_id` text,
	`claimed_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "participant_codes_sequence_check" CHECK("participant_codes"."sequence" in ('AX_BY','AY_BX','BX_AY','BY_AX')),
	CONSTRAINT "participant_codes_status_check" CHECK("participant_codes"."status" in ('available','claimed','disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_participant_codes_claimed_session` ON `participant_codes` (`claimed_session_id`);--> statement-breakpoint
CREATE INDEX `idx_participant_codes_status_sequence` ON `participant_codes` (`status`,`sequence`);--> statement-breakpoint
CREATE TABLE `session_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`revision` integer NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_session_events_session_revision` ON `session_events` (`session_id`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_session_events_session` ON `session_events` (`session_id`,`revision`);