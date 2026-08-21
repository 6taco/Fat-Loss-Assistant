-- Authentication and local-data import tables.
-- The User.authUserId column remains nullable for forward-compatible rollout.

CREATE TABLE `AuthUser` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AuthUser_email_key`(`email`),
  INDEX `AuthUser_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User` ADD COLUMN `authUserId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `User_authUserId_key` ON `User`(`authUserId`);
ALTER TABLE `User` ADD CONSTRAINT `User_authUserId_fkey` FOREIGN KEY (`authUserId`) REFERENCES `AuthUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `Session` (
  `id` VARCHAR(191) NOT NULL,
  `authUserId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(128) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `lastSeenAt` DATETIME(3) NOT NULL,
  `userAgent` VARCHAR(512) NULL,
  `ipHash` VARCHAR(128) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
  INDEX `Session_authUserId_revokedAt_idx`(`authUserId`, `revokedAt`),
  INDEX `Session_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `Session` ADD CONSTRAINT `Session_authUserId_fkey` FOREIGN KEY (`authUserId`) REFERENCES `AuthUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `AuthToken` (
  `id` VARCHAR(191) NOT NULL,
  `authUserId` VARCHAR(191) NOT NULL,
  `type` ENUM('password_reset') NOT NULL,
  `tokenHash` VARCHAR(128) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `AuthToken_tokenHash_key`(`tokenHash`),
  INDEX `AuthToken_authUserId_type_createdAt_idx`(`authUserId`, `type`, `createdAt`),
  INDEX `AuthToken_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_authUserId_fkey` FOREIGN KEY (`authUserId`) REFERENCES `AuthUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `AuthRateLimit` (
  `id` VARCHAR(191) NOT NULL,
  `scopeKey` VARCHAR(255) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `windowStartedAt` DATETIME(3) NOT NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AuthRateLimit_scopeKey_key`(`scopeKey`),
  INDEX `AuthRateLimit_action_updatedAt_idx`(`action`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DataImportBatch` (
  `id` VARCHAR(191) NOT NULL,
  `authUserId` VARCHAR(191) NOT NULL,
  `sourceAccountId` VARCHAR(191) NULL,
  `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `counts` JSON NULL,
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  INDEX `DataImportBatch_authUserId_createdAt_idx`(`authUserId`, `createdAt`),
  INDEX `DataImportBatch_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `DataImportBatch` ADD CONSTRAINT `DataImportBatch_authUserId_fkey` FOREIGN KEY (`authUserId`) REFERENCES `AuthUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `DataImportChunk` (
  `id` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `dataset` VARCHAR(64) NOT NULL,
  `chunkIndex` INTEGER NOT NULL,
  `payload` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DataImportChunk_batchId_dataset_chunkIndex_key`(`batchId`, `dataset`, `chunkIndex`),
  INDEX `DataImportChunk_batchId_dataset_idx`(`batchId`, `dataset`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `DataImportChunk` ADD CONSTRAINT `DataImportChunk_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `DataImportBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `DataImportItem` (
  `id` VARCHAR(191) NOT NULL,
  `authUserId` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `dataset` VARCHAR(64) NOT NULL,
  `sourceId` VARCHAR(255) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DataImportItem_authUserId_dataset_sourceId_key`(`authUserId`, `dataset`, `sourceId`),
  INDEX `DataImportItem_batchId_idx`(`batchId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `DataImportItem` ADD CONSTRAINT `DataImportItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `DataImportBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
