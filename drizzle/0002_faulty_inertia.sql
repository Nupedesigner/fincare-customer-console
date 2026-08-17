CREATE TABLE `administration_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankId` int NOT NULL,
	`module` enum('faq','product','sdk','webhook','environment','api_log','queue','escalation','organization') NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('draft','pending','ready','active','review','disabled','archived') NOT NULL DEFAULT 'draft',
	`detail` text,
	`metadata` text,
	`createdByUserId` int NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `administration_records_id` PRIMARY KEY(`id`)
);
