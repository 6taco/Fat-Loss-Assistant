-- Add missing columns to ActionProposal that were added to schema but never migrated
ALTER TABLE `ActionProposal`
  ADD COLUMN IF NOT EXISTS `toolName` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `executionState` VARCHAR(191) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS `diffPreview` JSON NULL,
  ADD COLUMN IF NOT EXISTS `approvedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `approvedByUserId` VARCHAR(191) NULL;

-- Add index on toolName if not exists
CREATE INDEX IF NOT EXISTS `ActionProposal_toolName_idx` ON `ActionProposal`(`toolName`);
