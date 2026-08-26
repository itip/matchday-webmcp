CREATE TABLE `competitions` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`tier` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_competitions_provider_id` ON `competitions` (`provider_id`);--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`competition_id` integer NOT NULL,
	`kickoff_utc` text NOT NULL,
	`home_team_id` integer NOT NULL,
	`away_team_id` integer NOT NULL,
	`status` text NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`venue` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fixtures_provider_id` ON `fixtures` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_fixtures_kickoff` ON `fixtures` (`kickoff_utc`);--> statement-breakpoint
CREATE INDEX `idx_fixtures_home_kickoff` ON `fixtures` (`home_team_id`,`kickoff_utc`);--> statement-breakpoint
CREATE INDEX `idx_fixtures_away_kickoff` ON `fixtures` (`away_team_id`,`kickoff_utc`);--> statement-breakpoint
CREATE INDEX `idx_fixtures_competition_kickoff` ON `fixtures` (`competition_id`,`kickoff_utc`);--> statement-breakpoint
CREATE TABLE `team_aliases` (
	`alias` text PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_team_aliases_team_id` ON `team_aliases` (`team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`short_name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_teams_provider_id` ON `teams` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_teams_normalized_name` ON `teams` (`normalized_name`);