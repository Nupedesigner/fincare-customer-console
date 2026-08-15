CREATE TABLE `agent_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`agentName` varchar(120) NOT NULL,
	`welcomeMessage` text NOT NULL,
	`description` text NOT NULL,
	`supportedLanguages` text NOT NULL,
	`customerTone` varchar(120) NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_configs_bankId_unique` UNIQUE(`bankId`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(180) NOT NULL,
	`module` varchar(120) NOT NULL,
	`resourceType` varchar(120) NOT NULL,
	`resourceId` varchar(128),
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('bank_owner','bank_admin','support_manager','support_agent','analyst','compliance_officer') NOT NULL,
	`status` enum('active','disabled','invited') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `banks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banks_id` PRIMARY KEY(`id`),
	CONSTRAINT `banks_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `channel_deployments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`channel` enum('web_banking','mobile_banking') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`status` enum('pending','connected','disabled','error') NOT NULL DEFAULT 'pending',
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channel_deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`externalReference` varchar(128) NOT NULL,
	`customerReference` varchar(128) NOT NULL,
	`channel` enum('web','mobile','whatsapp') NOT NULL,
	`intent` varchar(160) NOT NULL,
	`resolutionStatus` enum('active','resolved','escalated','fallback','closed') NOT NULL DEFAULT 'active',
	`escalated` boolean NOT NULL DEFAULT false,
	`assignedUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deployment_releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`environment` enum('sandbox','testing','production') NOT NULL,
	`status` enum('draft','ready','active','superseded','failed') NOT NULL DEFAULT 'draft',
	`deployedByUserId` int,
	`deployedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deployment_releases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`kind` enum('core_banking','crm_live_agent','web_banking','mobile_banking') NOT NULL,
	`status` enum('pending','testing','connected','error','disabled') NOT NULL DEFAULT 'pending',
	`endpointLabel` varchar(255) NOT NULL,
	`permissions` text NOT NULL,
	`lastSuccessfulRequestAt` timestamp,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` enum('loans','savings','fixed_deposits','cards','forex','investments','general_banking','faqs') NOT NULL,
	`sourceType` enum('document','article','url') NOT NULL,
	`version` varchar(32) NOT NULL,
	`indexingStatus` enum('pending','indexing','indexed','failed','archived') NOT NULL DEFAULT 'pending',
	`sourceUrl` varchar(2048),
	`storageKey` varchar(512),
	`createdByUserId` int NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
