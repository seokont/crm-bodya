CREATE TABLE `User` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  INDEX `User_name_idx`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Client` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` ENUM('PERSON', 'FOP', 'COMPANY') NOT NULL DEFAULT 'COMPANY',
  `companyName` VARCHAR(191) NULL,
  `contactName` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `secondaryPhone` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `edrpou` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `website` VARCHAR(191) NULL,
  `status` ENUM('NEW', 'IN_PROGRESS', 'CONTACTED', 'WAITING', 'INTERESTED', 'NOT_INTERESTED', 'CLIENT', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
  `source` VARCHAR(191) NULL,
  `managerId` INTEGER NULL,
  `comment` TEXT NULL,
  `isArchived` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Client_companyName_idx`(`companyName`),
  INDEX `Client_contactName_idx`(`contactName`),
  INDEX `Client_phone_idx`(`phone`),
  INDEX `Client_email_idx`(`email`),
  INDEX `Client_edrpou_idx`(`edrpou`),
  INDEX `Client_status_idx`(`status`),
  INDEX `Client_source_idx`(`source`),
  INDEX `Client_city_idx`(`city`),
  INDEX `Client_managerId_idx`(`managerId`),
  INDEX `Client_createdAt_idx`(`createdAt`),
  INDEX `Client_isArchived_idx`(`isArchived`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Client`
  ADD CONSTRAINT `Client_managerId_fkey`
  FOREIGN KEY (`managerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
