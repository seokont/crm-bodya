ALTER TABLE `Client`
  ADD COLUMN `creatorId` INTEGER NULL,
  ADD COLUMN `creatorName` VARCHAR(191) NULL;

UPDATE `Client` AS client
LEFT JOIN `User` AS manager ON manager.`id` = client.`managerId`
SET
  client.`creatorId` = client.`managerId`,
  client.`creatorName` = manager.`name`
WHERE client.`managerId` IS NOT NULL;

CREATE INDEX `Client_creatorId_idx` ON `Client`(`creatorId`);

ALTER TABLE `Client`
  ADD CONSTRAINT `Client_creatorId_fkey`
  FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
