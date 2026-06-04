-- Add tables that exist in schema.prisma but were not captured in earlier migrations.

CREATE TABLE IF NOT EXISTS `AgentRun` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `runType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `input` JSON NOT NULL,
    `output` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `AgentRun_userId_startedAt_idx`(`userId`, `startedAt`),
    INDEX `AgentRun_runType_status_idx`(`runType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgentMessage` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fromAgent` VARCHAR(191) NOT NULL,
    `toAgent` VARCHAR(191) NOT NULL,
    `messageType` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `confidence` VARCHAR(191) NOT NULL,
    `evidenceRefs` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentMessage_runId_idx`(`runId`),
    INDEX `AgentMessage_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AgentMessage_fromAgent_toAgent_idx`(`fromAgent`, `toAgent`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgentFinding` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `agent` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `evidence` JSON NOT NULL,
    `confidence` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentFinding_runId_idx`(`runId`),
    INDEX `AgentFinding_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AgentFinding_agent_type_idx`(`agent`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgentMemory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `agent` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentMemory_userId_agent_idx`(`userId`, `agent`),
    INDEX `AgentMemory_userId_type_idx`(`userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ToolDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `riskLevel` VARCHAR(191) NOT NULL,
    `requiresConfirmation` BOOLEAN NOT NULL DEFAULT true,
    `inputSchema` JSON NOT NULL,
    `outputSchema` JSON NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ToolDefinition_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ToolInvocationLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `toolName` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL,
    `rawInput` JSON NOT NULL,
    `parsedInput` JSON NULL,
    `validationError` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ToolInvocationLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ToolInvocationLog_toolName_createdAt_idx`(`toolName`, `createdAt`),
    INDEX `ToolInvocationLog_proposalId_idx`(`proposalId`),
    INDEX `ToolInvocationLog_idempotencyKey_idx`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ToolExecutionLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `toolName` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `durationMs` INTEGER NULL,
    `errorCode` VARCHAR(191) NULL,
    `resultJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ToolExecutionLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ToolExecutionLog_toolName_createdAt_idx`(`toolName`, `createdAt`),
    INDEX `ToolExecutionLog_proposalId_idx`(`proposalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ToolExecutionSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `toolName` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NULL,
    `beforeJson` JSON NOT NULL,
    `afterJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ToolExecutionSnapshot_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ToolExecutionSnapshot_toolName_createdAt_idx`(`toolName`, `createdAt`),
    INDEX `ToolExecutionSnapshot_proposalId_idx`(`proposalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AnalyticsIdentity` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `anonymousId` VARCHAR(191) NOT NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL,
    `firstUserAt` DATETIME(3) NULL,
    `lastUserAt` DATETIME(3) NULL,

    UNIQUE INDEX `AnalyticsIdentity_anonymousId_key`(`anonymousId`),
    INDEX `AnalyticsIdentity_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AnalyticsSession` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `anonymousId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `route` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'web',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AnalyticsSession_sessionId_key`(`sessionId`),
    INDEX `AnalyticsSession_userId_startedAt_idx`(`userId`, `startedAt`),
    INDEX `AnalyticsSession_anonymousId_startedAt_idx`(`anonymousId`, `startedAt`),
    INDEX `AnalyticsSession_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AnalyticsEvent` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `eventName` VARCHAR(191) NOT NULL,
    `eventVersion` INTEGER NOT NULL DEFAULT 1,
    `userId` VARCHAR(191) NULL,
    `anonymousId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `clientTs` BIGINT NULL,
    `route` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'web',
    `pageRef` VARCHAR(191) NULL,
    `properties` JSON NOT NULL,
    `context` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AnalyticsEvent_eventId_key`(`eventId`),
    INDEX `AnalyticsEvent_userId_occurredAt_idx`(`userId`, `occurredAt`),
    INDEX `AnalyticsEvent_anonymousId_occurredAt_idx`(`anonymousId`, `occurredAt`),
    INDEX `AnalyticsEvent_eventName_occurredAt_idx`(`eventName`, `occurredAt`),
    INDEX `AnalyticsEvent_sessionId_idx`(`sessionId`),
    INDEX `AnalyticsEvent_occurredAt_eventName_idx`(`occurredAt`, `eventName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AnalyticsDailyAggregate` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `eventName` VARCHAR(191) NOT NULL,
    `userCount` INTEGER NOT NULL DEFAULT 0,
    `eventCount` INTEGER NOT NULL DEFAULT 0,
    `sessionCount` INTEGER NOT NULL DEFAULT 0,
    `uniqueAnonymous` INTEGER NOT NULL DEFAULT 0,
    `properties` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AnalyticsDailyAggregate_date_idx`(`date`),
    INDEX `AnalyticsDailyAggregate_eventName_idx`(`eventName`),
    UNIQUE INDEX `AnalyticsDailyAggregate_date_eventName_key`(`date`, `eventName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AnalyticsUserLifecycle` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `anonymousId` VARCHAR(191) NULL,
    `registeredAt` DATETIME(3) NULL,
    `onboardingCompletedAt` DATETIME(3) NULL,
    `firstPlanGeneratedAt` DATETIME(3) NULL,
    `firstWeightLoggedAt` DATETIME(3) NULL,
    `firstMealLoggedAt` DATETIME(3) NULL,
    `firstPhotoUploadedAt` DATETIME(3) NULL,
    `firstDailyReportViewAt` DATETIME(3) NULL,
    `firstWeeklyReportViewAt` DATETIME(3) NULL,
    `firstAiChatAt` DATETIME(3) NULL,
    `firstCoachFeedViewAt` DATETIME(3) NULL,
    `firstProposalAcceptAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AnalyticsUserLifecycle_userId_key`(`userId`),
    INDEX `AnalyticsUserLifecycle_anonymousId_idx`(`anonymousId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
