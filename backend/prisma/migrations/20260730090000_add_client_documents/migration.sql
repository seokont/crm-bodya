CREATE TABLE `ClientDocument` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191) NOT NULL,
  `originalName` VARCHAR(255) NOT NULL,
  `storedName` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(150) NOT NULL,
  `size` INTEGER NOT NULL,
  `category` ENUM(
    'CONTRACT',
    'INVOICE',
    'ACT',
    'APPLICATION',
    'POWER_OF_ATTORNEY',
    'OTHER'
  ) NOT NULL DEFAULT 'OTHER',
  `description` TEXT NULL,
  `clientId` INTEGER NOT NULL,
  `uploaderId` INTEGER NULL,
  `uploaderName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ClientDocument_storedName_key`(`storedName`),
  INDEX `ClientDocument_clientId_createdAt_idx`(`clientId`, `createdAt`),
  INDEX `ClientDocument_uploaderId_idx`(`uploaderId`),
  INDEX `ClientDocument_category_idx`(`category`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientDocument`
  ADD CONSTRAINT `ClientDocument_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClientDocument`
  ADD CONSTRAINT `ClientDocument_uploaderId_fkey`
  FOREIGN KEY (`uploaderId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
