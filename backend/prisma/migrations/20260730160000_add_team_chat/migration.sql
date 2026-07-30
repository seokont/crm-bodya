CREATE TABLE `TeamMessage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `content` TEXT NOT NULL,
  `authorId` INTEGER NULL,
  `authorName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `TeamMessage_authorId_idx`(`authorId`),
  INDEX `TeamMessage_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TeamMessage`
  ADD CONSTRAINT `TeamMessage_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
