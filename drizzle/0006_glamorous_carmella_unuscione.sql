CREATE TABLE `developer_api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`environment` enum('sandbox','production') NOT NULL DEFAULT 'sandbox',
	`name` varchar(160) NOT NULL,
	`scopes` text NOT NULL,
	`keyLast4` varchar(4) NOT NULL,
	`secretHash` varchar(128) NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_api_keys_id` PRIMARY KEY(`id`)
);
