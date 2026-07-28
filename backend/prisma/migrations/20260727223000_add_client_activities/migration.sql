CREATE TABLE `ClientActivity` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` ENUM(
    'NOTE',
    'CALL',
    'EMAIL',
    'MEETING',
    'STATUS_CHANGE',
    'SYSTEM'
  ) NOT NULL DEFAULT 'NOTE',
  `content` TEXT NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `clientId` INTEGER NOT NULL,
  `authorId` INTEGER NULL,
  `authorName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ClientActivity_clientId_occurredAt_idx`(`clientId`, `occurredAt`),
  INDEX `ClientActivity_authorId_idx`(`authorId`),
  INDEX `ClientActivity_type_idx`(`type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientActivity`
  ADD CONSTRAINT `ClientActivity_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClientActivity`
  ADD CONSTRAINT `ClientActivity_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `ClientActivity` (
  `type`,
  `content`,
  `occurredAt`,
  `clientId`,
  `authorId`,
  `authorName`,
  `createdAt`,
  `updatedAt`
)
SELECT
  'SYSTEM',
  'Клієнта додано до CRM',
  client.`createdAt`,
  client.`id`,
  client.`managerId`,
  COALESCE(manager.`name`, 'Система'),
  client.`createdAt`,
  client.`createdAt`
FROM `Client` AS client
LEFT JOIN `User` AS manager ON manager.`id` = client.`managerId`;
