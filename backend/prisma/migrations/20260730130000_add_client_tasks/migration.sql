CREATE TABLE `ClientTask` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  `dueAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `clientId` INTEGER NOT NULL,
  `assigneeId` INTEGER NULL,
  `assigneeName` VARCHAR(191) NULL,
  `creatorId` INTEGER NULL,
  `creatorName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ClientTask_clientId_status_idx`(`clientId`, `status`),
  INDEX `ClientTask_assigneeId_status_idx`(`assigneeId`, `status`),
  INDEX `ClientTask_creatorId_idx`(`creatorId`),
  INDEX `ClientTask_dueAt_idx`(`dueAt`),
  INDEX `ClientTask_priority_idx`(`priority`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientTask`
  ADD CONSTRAINT `ClientTask_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClientTask`
  ADD CONSTRAINT `ClientTask_assigneeId_fkey`
  FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ClientTask`
  ADD CONSTRAINT `ClientTask_creatorId_fkey`
  FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
