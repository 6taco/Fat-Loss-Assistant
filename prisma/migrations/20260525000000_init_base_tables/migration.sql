CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `gender` ENUM('male', 'female') NOT NULL,
  `age` INTEGER NOT NULL,
  `height` DOUBLE NOT NULL,
  `weight` DOUBLE NOT NULL,
  `bodyFat` DOUBLE NOT NULL,
  `trainingFrequency` INTEGER NOT NULL,
  `trainingIntensity` ENUM('low', 'medium', 'high') NOT NULL,
  `startDate` DATETIME(3) NOT NULL,
  `initialWeightDate` DATE NULL,
  `goalWeight` DOUBLE NOT NULL,
  `somatotype` VARCHAR(191) NOT NULL DEFAULT 'mesomorph',
  `trainingSchedule` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DayPlan` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `carbType` ENUM('high', 'mid', 'low') NOT NULL,
  `calories` INTEGER NOT NULL,
  `carb` INTEGER NOT NULL,
  `protein` INTEGER NOT NULL,
  `fat` INTEGER NOT NULL,
  `completed` BOOLEAN NOT NULL DEFAULT false,
  `muscleGroup` VARCHAR(191) NULL,
  `trainingLabel` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DayPlan_userId_date_key`(`userId`, `date`),
  INDEX `DayPlan_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatMessage` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `role` ENUM('user', 'ai') NOT NULL,
  `content` TEXT NOT NULL,
  `cards` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ChatMessage_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WeightEntry` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `weight` DOUBLE NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WeightEntry_userId_date_key`(`userId`, `date`),
  INDEX `WeightEntry_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MealLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `mealType` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `items` JSON NOT NULL,
  `carb` DOUBLE NOT NULL,
  `protein` DOUBLE NOT NULL,
  `fat` DOUBLE NOT NULL,
  `calories` INTEGER NULL,
  `source` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `MealLog_userId_date_idx`(`userId`, `date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DayPlan` ADD CONSTRAINT `DayPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WeightEntry` ADD CONSTRAINT `WeightEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MealLog` ADD CONSTRAINT `MealLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
