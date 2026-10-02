-- =======================================================================
-- VYOMANTRA TECHNOLOGIES - PRODUCTION DATABASE SCHEMA (HOSTINGER MYSQL READY)
-- =======================================================================
-- Quick Setup on Hostinger:
-- 1. Log in to Hostinger hPanel -> Databases -> MySQL Databases.
-- 2. Create a new Database (e.g., u123456789_vyomantra) and User with password.
-- 3. Click "Enter phpMyAdmin" beside your new database.
-- 4. In phpMyAdmin, click "Import" tab at the top.
-- 5. Choose this schema.sql file and click "Go" at the bottom.
-- 6. Open api/config.php and update DB_HOST, DB_NAME, DB_USER, DB_PASS.
-- =======================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+05:30";

-- -----------------------------------------------------------------------
-- 1. Contact Form Submissions Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `service` VARCHAR(100) DEFAULT 'General Inquiry',
  `message` TEXT NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `status` ENUM('new', 'contacted', 'resolved', 'archived') DEFAULT 'new',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email` (`email`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- 2. Career Job & Internship Applications Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `job_applications` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `role_applied` VARCHAR(100) NOT NULL,
  `experience` VARCHAR(50) DEFAULT 'Fresher',
  `portfolio_url` VARCHAR(255) DEFAULT NULL,
  `resume_filename` VARCHAR(255) DEFAULT NULL,
  `resume_filepath` VARCHAR(255) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `status` ENUM('applied', 'reviewing', 'interview_scheduled', 'offered', 'rejected') DEFAULT 'applied',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email` (`email`),
  INDEX `idx_role` (`role_applied`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- 3. Course Registrations & Payment Submissions Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_registrations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `student_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `course_name` VARCHAR(150) NOT NULL,
  `course_mode` VARCHAR(50) DEFAULT 'Live Online',
  `amount_paid` DECIMAL(10, 2) DEFAULT 649.00,
  `reference_number` VARCHAR(100) NOT NULL,
  `screenshot_filename` VARCHAR(255) DEFAULT NULL,
  `screenshot_filepath` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `payment_status` ENUM('pending_verification', 'verified', 'rejected') DEFAULT 'pending_verification',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_reference` (`reference_number`),
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- 4. Project Quote Requests Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quote_requests` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `company` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `service` VARCHAR(100) NOT NULL,
  `project_type` VARCHAR(100) DEFAULT NULL,
  `budget` VARCHAR(100) DEFAULT NULL,
  `timeline` VARCHAR(100) DEFAULT NULL,
  `description` TEXT NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `status` ENUM('new', 'contacted', 'proposal_sent', 'closed') DEFAULT 'new',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email` (`email`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- 5. Admin Users & Authentication Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('super_admin', 'editor') DEFAULT 'super_admin',
  `auth_token` VARCHAR(255) DEFAULT NULL,
  `token_expiry` DATETIME DEFAULT NULL,
  `last_login` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default Super Admin user (Password: Vyomantra@2026)
INSERT INTO `admin_users` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`, `created_at`) 
VALUES (1, 'admin', 'vyomantratech@gmail.com', '$2y$10$gm9vteZEX1Qqou5x.dYAP.AQKDRbS26pkVA7ijC6FrRLbDVSR1OwC', 'Vyomantra Administrator', 'super_admin', NOW())
ON DUPLICATE KEY UPDATE `username`=`username`;

-- -----------------------------------------------------------------------
-- 6. Job & Internship Postings (CMS Managed)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `job_postings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `title` VARCHAR(150) NOT NULL,
  `category` ENUM('engineering', 'ai', 'design', 'marketing') NOT NULL,
  `department_label` VARCHAR(100) NOT NULL,
  `job_type` ENUM('fulltime', 'internship', 'contract') NOT NULL,
  `work_mode` ENUM('hybrid', 'remote', 'onsite') NOT NULL,
  `experience_level` ENUM('fresher', 'experienced') NOT NULL,
  `experience_text` VARCHAR(80) NOT NULL,
  `location_text` VARCHAR(100) NOT NULL,
  `compensation_text` VARCHAR(100) NOT NULL,
  `summary` TEXT NOT NULL,
  `about_role` TEXT NOT NULL,
  `responsibilities` TEXT NOT NULL, -- JSON array of strings
  `qualifications` TEXT NOT NULL,
  `competencies` TEXT NOT NULL,     -- JSON array of strings
  `tech_stack` TEXT NOT NULL,       -- JSON array of strings
  `status` ENUM('active', 'reviewing', 'closed', 'draft') DEFAULT 'active',
  `date_posted` DATE NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_slug` (`slug`),
  INDEX `idx_status` (`status`),
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- 7. Technical Courses & Masterclasses (CMS Managed)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `title` VARCHAR(180) NOT NULL,
  `badge` VARCHAR(80) DEFAULT 'Live Online Cohort',
  `category` VARCHAR(80) DEFAULT 'programming',
  `duration` VARCHAR(80) DEFAULT '1 Month',
  `mode` VARCHAR(60) DEFAULT 'Live Online',
  `fee` DECIMAL(10, 2) NOT NULL DEFAULT 649.00,
  `original_fee` DECIMAL(10, 2) DEFAULT 24999.00,
  `seats_label` VARCHAR(80) DEFAULT 'Seats Limited',
  `summary` TEXT NOT NULL,
  `syllabus` TEXT DEFAULT NULL,       -- JSON array of strings
  `features` TEXT DEFAULT NULL,       -- JSON array of strings
  `mentor_name` VARCHAR(120) DEFAULT 'VYOMANTRA Technical Lead',
  `whatsapp_phone` VARCHAR(30) DEFAULT '918122288855',
  `status` ENUM('active', 'upcoming', 'closed', 'draft') DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_course_slug` (`slug`),
  INDEX `idx_course_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- 8. Certificate Verification & Management Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `certificates` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `certificate_id` VARCHAR(60) NOT NULL UNIQUE,
  `certificate_type` VARCHAR(80) NOT NULL DEFAULT 'Course Completion',
  `prefix` VARCHAR(25) NOT NULL DEFAULT 'VYOM-CRT',
  `recipient_name` VARCHAR(150) NOT NULL,
  `recipient_email` VARCHAR(150) DEFAULT NULL,
  `course_name` VARCHAR(180) NOT NULL,
  `course_duration` VARCHAR(100) DEFAULT '3 Months',
  `description` TEXT DEFAULT NULL,
  `trainer_name` VARCHAR(120) DEFAULT 'Santhosh S',
  `trainer_designation` VARCHAR(120) DEFAULT 'Lead Technical Instructor',
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
  `template_id` VARCHAR(50) DEFAULT 'vyomantra_premium_v1',
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

-- -----------------------------------------------------------------------
-- 9. Certificate Verification Audit Logs Table
-- -----------------------------------------------------------------------
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
