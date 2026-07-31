ALTER TABLE `ClientTask`
  ADD COLUMN `kind` ENUM('GENERAL', 'CALL') NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN `remindAt` DATETIME(3) NULL,
  ADD COLUMN `reminderNotifiedAt` DATETIME(3) NULL,
  ADD COLUMN `reminderReadAt` DATETIME(3) NULL;

CREATE INDEX `ClientTask_kind_status_idx`
  ON `ClientTask`(`kind`, `status`);

CREATE INDEX `ClientTask_assigneeId_reminderReadAt_remindAt_idx`
  ON `ClientTask`(`assigneeId`, `reminderReadAt`, `remindAt`);
