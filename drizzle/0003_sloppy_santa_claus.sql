CREATE TABLE `user_profile_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailDigest` boolean NOT NULL DEFAULT true,
	`securityAlerts` boolean NOT NULL DEFAULT true,
	`productUpdates` boolean NOT NULL DEFAULT false,
	`defaultWorkspace` enum('overview','conversations','analytics') NOT NULL DEFAULT 'overview',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profile_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profile_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_sign_in_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`signInProvider` varchar(64) NOT NULL,
	`deviceLabel` varchar(160) NOT NULL,
	`browser` varchar(120) NOT NULL,
	`operatingSystem` varchar(120) NOT NULL,
	`source` enum('oauth','managed_session') NOT NULL DEFAULT 'oauth',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sign_in_activities_id` PRIMARY KEY(`id`)
);
