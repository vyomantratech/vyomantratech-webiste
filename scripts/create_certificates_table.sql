-- VYOMANTRA TECHNOLOGIES - CERTIFICATE MANAGEMENT TABLES MIGRATION
-- Run this in phpMyAdmin or MySQL CLI to add certificate verification to existing database

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+05:30";

CREATE TABLE IF NOT EXISTS `certificates` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `certificate_id` VARCHAR(60) NOT NULL UNIQUE,
  `certificate_type` VARCHAR(80) NOT NULL DEFAULT 'Completion',
  `program_type` VARCHAR(40) NOT NULL DEFAULT 'Training Program',
  `recognition` VARCHAR(40) NOT NULL DEFAULT 'Completed',
  `prefix` VARCHAR(25) NOT NULL DEFAULT 'VYOM-CRS',
  `recipient_name` VARCHAR(150) NOT NULL,
  `recipient_email` VARCHAR(150) DEFAULT NULL,
  `course_name` VARCHAR(180) NOT NULL,
  `course_duration` VARCHAR(100) DEFAULT '1 Month',
  `description` TEXT DEFAULT NULL,
  `trainer_name` VARCHAR(120) DEFAULT 'Santhosh S',
  `trainer_designation` VARCHAR(120) DEFAULT 'Program Lead',
  `signatory_name` VARCHAR(120) DEFAULT 'S.B. Sachin',
  `signatory_designation` VARCHAR(120) DEFAULT 'Founder & CEO',
  `issue_date` DATE NOT NULL,
  `completion_date` DATE DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `status` ENUM('valid', 'revoked', 'expired', 'draft') DEFAULT 'valid',
  `verification_token` VARCHAR(64) NOT NULL UNIQUE,
  `verification_url` VARCHAR(255) DEFAULT NULL,
  `qr_code_url` TEXT DEFAULT NULL,
  `certificate_pdf_url` VARCHAR(255) DEFAULT NULL,
  `final_docx_url` VARCHAR(255) DEFAULT NULL,
  `template_id` VARCHAR(80) DEFAULT '1month_python_course',
  `issued_by` VARCHAR(120) DEFAULT 'VYOMANTRA TECHNOLOGIES',
  `private_notes` TEXT DEFAULT NULL,
  `revoked_at` DATETIME DEFAULT NULL,
  `revoked_by` VARCHAR(100) DEFAULT NULL,
  `revocation_reason` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cert_id` (`certificate_id`),
  INDEX `idx_cert_status` (`status`),
  INDEX `idx_cert_token` (`verification_token`),
  INDEX `idx_cert_recipient` (`recipient_name`),
  INDEX `idx_cert_issue_date` (`issue_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `certificate_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `certificate_id` VARCHAR(60) NOT NULL,
  `verification_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verification_method` ENUM('QR_SCAN', 'MANUAL_ID') NOT NULL DEFAULT 'QR_SCAN',
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `result` ENUM('valid', 'revoked', 'expired', 'not_found') NOT NULL DEFAULT 'valid',
  PRIMARY KEY (`id`),
  INDEX `idx_log_cert_id` (`certificate_id`),
  INDEX `idx_log_timestamp` (`verification_timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
