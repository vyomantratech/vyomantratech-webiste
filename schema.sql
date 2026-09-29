-- =======================================================================
-- VYOMANTRA TECHNOLOGIES - DATABASE SCHEMA (HOSTINGER MYSQL READY)
-- =======================================================================
-- Instructions for Hostinger:
-- 1. Go to Hostinger cPanel / hPanel -> Databases -> MySQL Databases.
-- 2. Create a new Database (e.g., u123456789_vyomantra) and User with password.
-- 3. Open phpMyAdmin for that database.
-- 4. Click "Import" -> Select this schema.sql file -> Click "Go".
-- 5. Open api/config.php and update DB_HOST, DB_NAME, DB_USER, DB_PASS.
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

COMMIT;

