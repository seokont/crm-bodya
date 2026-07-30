CREATE TABLE `ClientComment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `content` TEXT NOT NULL,
  `clientId` INTEGER NOT NULL,
  `authorId` INTEGER NULL,
  `authorName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ClientComment_clientId_createdAt_idx`(`clientId`, `createdAt`),
  INDEX `ClientComment_authorId_idx`(`authorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientComment`
  ADD CONSTRAINT `ClientComment_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClientComment`
  ADD CONSTRAINT `ClientComment_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
