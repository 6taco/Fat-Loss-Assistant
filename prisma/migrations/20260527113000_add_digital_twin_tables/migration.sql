CREATE TABLE `DigitalTwinProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `version` VARCHAR(191) NOT NULL DEFAULT 'digital-twin-v1',
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dataStartDate` DATE NULL,
  `dataEndDate` DATE NULL,
  `dataQuality` JSON NOT NULL,
  `persona` JSON NOT NULL,
  `behaviorProfile` JSON NOT NULL,
  `nutritionProfile` JSON NOT NULL,
  `trainingProfile` JSON NOT NULL,
  `plateauProfile` JSON NOT NULL,
  `modelSummary` JSON NOT NULL,
  `confidence` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DigitalTwinFeatureSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `windowDays` INTEGER NOT NULL,
  `features` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DigitalTwinPrediction` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NULL,
  `scenarioId` VARCHAR(191) NULL,
  `horizonDays` INTEGER NOT NULL,
  `currentWeight` DOUBLE NOT NULL,
  `predictedWeight` DOUBLE NULL,
  `goalProbability` INTEGER NOT NULL,
  `slopeKgPerDay` DOUBLE NOT NULL,
  `plateauRisk` VARCHAR(191) NOT NULL,
  `forecast` JSON NOT NULL,
  `assumptions` JSON NOT NULL,
  `confidence` VARCHAR(191) NOT NULL,
  `modelVersion` VARCHAR(191) NOT NULL DEFAULT 'digital-twin-v1',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DigitalTwinScenario` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `assumptions` JSON NOT NULL,
  `result` JSON NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DigitalTwinProfile_userId_generatedAt_idx` ON `DigitalTwinProfile`(`userId`, `generatedAt`);
CREATE UNIQUE INDEX `DigitalTwinFeatureSnapshot_userId_date_windowDays_key` ON `DigitalTwinFeatureSnapshot`(`userId`, `date`, `windowDays`);
CREATE INDEX `DigitalTwinFeatureSnapshot_userId_date_idx` ON `DigitalTwinFeatureSnapshot`(`userId`, `date`);
CREATE INDEX `DigitalTwinPrediction_userId_createdAt_idx` ON `DigitalTwinPrediction`(`userId`, `createdAt`);
CREATE INDEX `DigitalTwinPrediction_profileId_idx` ON `DigitalTwinPrediction`(`profileId`);
CREATE INDEX `DigitalTwinPrediction_scenarioId_idx` ON `DigitalTwinPrediction`(`scenarioId`);
CREATE INDEX `DigitalTwinScenario_userId_createdAt_idx` ON `DigitalTwinScenario`(`userId`, `createdAt`);
CREATE INDEX `DigitalTwinScenario_type_idx` ON `DigitalTwinScenario`(`type`);
