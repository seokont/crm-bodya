ALTER TABLE `User`
  ADD COLUMN `passwordHash` VARCHAR(191) NULL,
  ADD COLUMN `role` ENUM('ADMIN', 'MANAGER') NOT NULL DEFAULT 'MANAGER',
  ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

CREATE INDEX `User_role_idx` ON `User`(`role`);
CREATE INDEX `User_isActive_idx` ON `User`(`isActive`);
