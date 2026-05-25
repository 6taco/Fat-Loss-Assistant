CREATE TABLE `WeightPrediction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentWeight` DOUBLE NOT NULL,
    `goalWeight` DOUBLE NOT NULL,
    `estimatedGoalDate` DATE NULL,
    `estimatedDaysToGoal` INTEGER NULL,
    `goalProbability` INTEGER NOT NULL,
    `slopeKgPerDay` DOUBLE NOT NULL,
    `residualStd` DOUBLE NOT NULL,
    `plateauStatus` VARCHAR(191) NOT NULL,
    `plateauReason` TEXT NOT NULL,
    `calorieDeficitSummary` JSON NOT NULL,
    `forecast30Days` JSON NOT NULL,
    `modelVersion` VARCHAR(191) NOT NULL DEFAULT 'linear-regression-v1',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeightPrediction_userId_idx`(`userId`),
    INDEX `WeightPrediction_userId_generatedAt_idx`(`userId`, `generatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WeightPrediction` ADD CONSTRAINT `WeightPrediction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
