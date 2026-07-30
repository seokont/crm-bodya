ALTER TABLE `TeamMessage`
  ADD COLUMN `recipientId` INTEGER NULL;

CREATE INDEX `TeamMessage_recipientId_idx`
  ON `TeamMessage`(`recipientId`);

CREATE INDEX `TeamMessage_authorId_recipientId_createdAt_idx`
  ON `TeamMessage`(`authorId`, `recipientId`, `createdAt`);

ALTER TABLE `TeamMessage`
  ADD CONSTRAINT `TeamMessage_recipientId_fkey`
  FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
