CREATE TABLE `ClientDeal` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'UAH',
  `stage` ENUM(
    'NEW',
    'QUALIFICATION',
    'PROPOSAL',
    'NEGOTIATION',
    'WON',
    'LOST'
  ) NOT NULL DEFAULT 'NEW',
  `expectedCloseAt` DATETIME(3) NULL,
  `description` TEXT NULL,
  `clientId` INTEGER NOT NULL,
  `ownerId` INTEGER NULL,
  `ownerName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ClientDeal_clientId_stage_idx`(`clientId`, `stage`),
  INDEX `ClientDeal_ownerId_idx`(`ownerId`),
  INDEX `ClientDeal_expectedCloseAt_idx`(`expectedCloseAt`),
  INDEX `ClientDeal_stage_idx`(`stage`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientDeal`
  ADD CONSTRAINT `ClientDeal_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClientDeal`
  ADD CONSTRAINT `ClientDeal_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
