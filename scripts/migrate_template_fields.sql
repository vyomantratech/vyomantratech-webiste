-- =========================================================================
-- VYOMANTRA TECHNOLOGIES - CERTIFICATE TEMPLATE FIELDS & SCHEMA ALIGNMENT
-- Tailored to: assets/1month_python course.docx
-- =========================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+05:30";

-- 1. Ensure certificates table columns match 1month_python course.docx template
ALTER TABLE `certificates`
  MODIFY COLUMN `course_duration` VARCHAR(100) DEFAULT '1 Month',
  MODIFY COLUMN `trainer_name` VARCHAR(120) DEFAULT 'Santhosh S',
  MODIFY COLUMN `trainer_designation` VARCHAR(120) DEFAULT 'Program Lead',
  MODIFY COLUMN `signatory_name` VARCHAR(120) DEFAULT 'S.B. Sachin',
  MODIFY COLUMN `signatory_designation` VARCHAR(120) DEFAULT 'Founder & CEO',
  MODIFY COLUMN `template_id` VARCHAR(80) DEFAULT '1month_python_course';

-- 2. Add final_docx_url if not already existing
SET @colExists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'certificates'
    AND COLUMN_NAME = 'final_docx_url'
);

SET @sql = IF(@colExists = 0,
  'ALTER TABLE `certificates` ADD COLUMN `final_docx_url` VARCHAR(255) DEFAULT NULL AFTER `certificate_pdf_url`',
  'SELECT "final_docx_url column already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Update legacy records to match new template naming
UPDATE `certificates`
SET `trainer_designation` = 'Program Lead'
WHERE `trainer_designation` = 'Lead Technical Instructor' OR `trainer_designation` IS NULL;

UPDATE `certificates`
SET `signatory_name` = 'S.B. Sachin',
    `signatory_designation` = 'Founder & CEO'
WHERE `signatory_name` IS NULL OR `signatory_name` = '';

COMMIT;
