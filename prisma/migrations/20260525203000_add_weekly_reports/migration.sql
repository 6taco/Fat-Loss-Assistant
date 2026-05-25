ALTER TABLE `DailyReport` ADD COLUMN `readAt` DATETIME(3) NULL;

CREATE TABLE `WeeklyReport` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `weekIndex` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `score` INTEGER NOT NULL,
    `summary` TEXT NOT NULL,
    `suggestions` JSON NOT NULL,
    `metrics` JSON NOT NULL,
    `risks` JSON NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeeklyReport_userId_idx`(`userId`),
    UNIQUE INDEX `WeeklyReport_userId_weekIndex_key`(`userId`, `weekIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WeeklyReport` ADD CONSTRAINT `WeeklyReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
