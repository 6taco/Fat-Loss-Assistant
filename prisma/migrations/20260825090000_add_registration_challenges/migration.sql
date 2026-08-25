CREATE TABLE `RegistrationChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `codeHash` VARCHAR(128) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `RegistrationChallenge_email_key`(`email`),
  INDEX `RegistrationChallenge_expiresAt_idx`(`expiresAt`),
  INDEX `RegistrationChallenge_consumedAt_idx`(`consumedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
