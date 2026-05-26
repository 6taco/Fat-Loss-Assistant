CREATE TABLE `KnowledgeSource` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `authority` VARCHAR(191) NOT NULL,
  `sourceType` VARCHAR(191) NOT NULL,
  `url` VARCHAR(191) NULL,
  `year` INTEGER NULL,
  `language` VARCHAR(191) NOT NULL DEFAULT 'zh',
  `license` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `checksum` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KnowledgeChunk` (
  `id` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `chunkIndex` INTEGER NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `text` TEXT NOT NULL,
  `summary` TEXT NULL,
  `topic` JSON NOT NULL,
  `metadata` JSON NOT NULL,
  `tokenCount` INTEGER NOT NULL,
  `embedding` JSON NULL,
  `embeddingModel` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RagQueryLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `question` TEXT NOT NULL,
  `intent` VARCHAR(191) NULL,
  `retrieved` JSON NOT NULL,
  `citations` JSON NOT NULL,
  `confidence` VARCHAR(191) NOT NULL,
  `latencyMs` INTEGER NOT NULL,
  `cost` DOUBLE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `KnowledgeSource_sourceType_idx` ON `KnowledgeSource`(`sourceType`);
CREATE INDEX `KnowledgeSource_authority_idx` ON `KnowledgeSource`(`authority`);
CREATE INDEX `KnowledgeSource_status_idx` ON `KnowledgeSource`(`status`);
CREATE INDEX `KnowledgeSource_checksum_idx` ON `KnowledgeSource`(`checksum`);
CREATE UNIQUE INDEX `KnowledgeChunk_sourceId_chunkIndex_key` ON `KnowledgeChunk`(`sourceId`, `chunkIndex`);
CREATE INDEX `KnowledgeChunk_sourceId_idx` ON `KnowledgeChunk`(`sourceId`);
CREATE INDEX `KnowledgeChunk_status_idx` ON `KnowledgeChunk`(`status`);
CREATE INDEX `RagQueryLog_userId_idx` ON `RagQueryLog`(`userId`);
CREATE INDEX `RagQueryLog_createdAt_idx` ON `RagQueryLog`(`createdAt`);

ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `KnowledgeSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
