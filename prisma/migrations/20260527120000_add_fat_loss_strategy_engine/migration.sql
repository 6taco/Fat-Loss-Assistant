ALTER TABLE `DayPlan`
  ADD COLUMN `strategyId` VARCHAR(191) NULL,
  ADD COLUMN `strategyType` ENUM('calorie_deficit', 'if_16_8', 'carb_cycling') NOT NULL DEFAULT 'carb_cycling',
  ADD COLUMN `fastingWindow` JSON NULL,
  ADD COLUMN `dayGoal` JSON NULL;

CREATE TABLE `UserLifestyleProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `sleepRegularity` VARCHAR(191) NOT NULL,
  `averageSleepHours` DOUBLE NULL,
  `workStudyRhythm` VARCHAR(191) NOT NULL,
  `oftenStaysUpLate` BOOLEAN NOT NULL DEFAULT false,
  `isStudent` BOOLEAN NOT NULL DEFAULT false,
  `dietRegularity` VARCHAR(191) NOT NULL,
  `bingeRisk` VARCHAR(191) NOT NULL,
  `takeawayFrequency` VARCHAR(191) NOT NULL,
  `complexPlanTolerance` VARCHAR(191) NOT NULL,
  `hasFitnessHabit` BOOLEAN NOT NULL DEFAULT false,
  `hasStrengthTraining` BOOLEAN NOT NULL DEFAULT false,
  `trainingExperience` VARCHAR(191) NOT NULL,
  `fatLossGoal` VARCHAR(191) NOT NULL,
  `targetWeeks` INTEGER NULL,
  `derivedMetrics` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `UserLifestyleProfile_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FatLossStrategyProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `strategyType` ENUM('calorie_deficit', 'if_16_8', 'carb_cycling') NOT NULL,
  `status` ENUM('active', 'superseded', 'paused') NOT NULL DEFAULT 'active',
  `intensity` ENUM('gentle', 'standard', 'aggressive') NOT NULL DEFAULT 'standard',
  `startDate` DATE NOT NULL,
  `endDate` DATE NULL,
  `tdee` INTEGER NULL,
  `targetCalories` INTEGER NULL,
  `proteinGrams` INTEGER NULL,
  `fastingWindow` JSON NULL,
  `carbCycleConfig` JSON NULL,
  `expectedLossKgPerWeek` DOUBLE NOT NULL,
  `stageGoal` VARCHAR(191) NOT NULL,
  `recommendationReasons` JSON NOT NULL,
  `scoreBreakdown` JSON NOT NULL,
  `safetyFlags` JSON NOT NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'strategy_engine_v1',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StrategyExecutionSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `strategyId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `executionRate` DOUBLE NOT NULL,
  `calorieHitRate` DOUBLE NULL,
  `proteinHitRate` DOUBLE NULL,
  `fastingHitRate` DOUBLE NULL,
  `trainingHitRate` DOUBLE NULL,
  `bingeCount` INTEGER NOT NULL DEFAULT 0,
  `plateauStatus` VARCHAR(191) NOT NULL,
  `metrics` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `StrategyExecutionSnapshot_userId_date_key`(`userId`, `date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StrategyAdjustmentProposal` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `fromStrategyId` VARCHAR(191) NULL,
  `toStrategyType` ENUM('calorie_deficit', 'if_16_8', 'carb_cycling') NULL,
  `status` ENUM('pending', 'accepted', 'dismissed', 'expired') NOT NULL DEFAULT 'pending',
  `title` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `reason` JSON NOT NULL,
  `diffPreview` JSON NOT NULL,
  `actionProposalId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `decidedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DayPlan_strategyId_idx` ON `DayPlan`(`strategyId`);
CREATE INDEX `DayPlan_strategyType_idx` ON `DayPlan`(`strategyType`);
CREATE INDEX `FatLossStrategyProfile_userId_status_idx` ON `FatLossStrategyProfile`(`userId`, `status`);
CREATE INDEX `FatLossStrategyProfile_userId_strategyType_idx` ON `FatLossStrategyProfile`(`userId`, `strategyType`);
CREATE INDEX `StrategyExecutionSnapshot_userId_strategyId_idx` ON `StrategyExecutionSnapshot`(`userId`, `strategyId`);
CREATE INDEX `StrategyAdjustmentProposal_userId_status_idx` ON `StrategyAdjustmentProposal`(`userId`, `status`);

ALTER TABLE `UserLifestyleProfile` ADD CONSTRAINT `UserLifestyleProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FatLossStrategyProfile` ADD CONSTRAINT `FatLossStrategyProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StrategyExecutionSnapshot` ADD CONSTRAINT `StrategyExecutionSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StrategyAdjustmentProposal` ADD CONSTRAINT `StrategyAdjustmentProposal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
