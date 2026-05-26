CREATE TABLE `CoachMemory` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `content` JSON NOT NULL,
  `confidence` DOUBLE NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CoachInsight` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `evidence` JSON NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'new',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ActionProposal` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `title` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `payload` JSON NOT NULL,
  `reason` JSON NOT NULL,
  `safety` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `decidedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MealPlan` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `meals` JSON NOT NULL,
  `macros` JSON NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TrainingPlan` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `startDate` DATE NOT NULL,
  `endDate` DATE NOT NULL,
  `days` JSON NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ShoppingList` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `startDate` DATE NOT NULL,
  `endDate` DATE NOT NULL,
  `items` JSON NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationEvent` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` VARCHAR(191) NOT NULL,
  `payload` JSON NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
  `scheduledAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `CoachMemory_userId_idx` ON `CoachMemory`(`userId`);
CREATE INDEX `CoachMemory_userId_type_idx` ON `CoachMemory`(`userId`, `type`);
CREATE INDEX `CoachInsight_userId_date_idx` ON `CoachInsight`(`userId`, `date`);
CREATE INDEX `CoachInsight_userId_status_idx` ON `CoachInsight`(`userId`, `status`);
CREATE INDEX `ActionProposal_userId_status_idx` ON `ActionProposal`(`userId`, `status`);
CREATE INDEX `ActionProposal_userId_type_idx` ON `ActionProposal`(`userId`, `type`);
CREATE UNIQUE INDEX `MealPlan_userId_date_key` ON `MealPlan`(`userId`, `date`);
CREATE INDEX `MealPlan_userId_idx` ON `MealPlan`(`userId`);
CREATE INDEX `TrainingPlan_userId_startDate_idx` ON `TrainingPlan`(`userId`, `startDate`);
CREATE INDEX `ShoppingList_userId_startDate_idx` ON `ShoppingList`(`userId`, `startDate`);
CREATE INDEX `NotificationEvent_userId_status_idx` ON `NotificationEvent`(`userId`, `status`);
CREATE INDEX `NotificationEvent_scheduledAt_idx` ON `NotificationEvent`(`scheduledAt`);

ALTER TABLE `CoachMemory` ADD CONSTRAINT `CoachMemory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CoachInsight` ADD CONSTRAINT `CoachInsight_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ActionProposal` ADD CONSTRAINT `ActionProposal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MealPlan` ADD CONSTRAINT `MealPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TrainingPlan` ADD CONSTRAINT `TrainingPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ShoppingList` ADD CONSTRAINT `ShoppingList_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NotificationEvent` ADD CONSTRAINT `NotificationEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
