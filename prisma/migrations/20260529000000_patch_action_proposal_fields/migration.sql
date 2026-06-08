-- Add missing columns to ActionProposal that were added to schema but never migrated
ALTER TABLE `ActionProposal`
  ADD COLUMN `toolName` VARCHAR(191) NULL,
  ADD COLUMN `executionState` VARCHAR(191) NOT NULL DEFAULT 'draft',
  ADD COLUMN `diffPreview` JSON NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL,
  ADD COLUMN `approvedByUserId` VARCHAR(191) NULL;

CREATE INDEX `ActionProposal_toolName_idx` ON `ActionProposal`(`toolName`);
