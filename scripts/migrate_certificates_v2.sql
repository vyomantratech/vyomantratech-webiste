-- VYOMANTRA TECHNOLOGIES - CERTIFICATES MIGRATION v2 (safe, additive)
-- Run once in phpMyAdmin on your EXISTING database. No data is deleted.
-- Adds the two fields used by the master certificate: program_type and recognition.
-- (course_name is now used as "Program / Event Name"; trainer_name as "Program Lead".)

ALTER TABLE `certificates`
  ADD COLUMN `program_type` VARCHAR(40) NOT NULL DEFAULT 'Training Program' AFTER `certificate_type`,
  ADD COLUMN `recognition`  VARCHAR(40) NOT NULL DEFAULT 'Completed' AFTER `program_type`;

-- Map old certificate types to the new type / program type / recognition values
UPDATE `certificates` SET
  `program_type` = CASE
      WHEN `certificate_type` LIKE '%Intern%'   THEN 'Internship'
      WHEN `certificate_type` LIKE '%Workshop%' THEN 'Workshop'
      WHEN `certificate_type` LIKE '%Event%'    THEN 'Webinar'
      ELSE 'Training Program' END,
  `recognition` = CASE
      WHEN `certificate_type` LIKE '%Intern%'        THEN 'Intern'
      WHEN `certificate_type` LIKE '%Participation%' THEN 'Participant'
      WHEN `certificate_type` LIKE '%Workshop%'      THEN 'Participant'
      WHEN `certificate_type` LIKE '%Event%'         THEN 'Participant'
      ELSE 'Completed' END,
  `certificate_type` = CASE
      WHEN `certificate_type` LIKE '%Intern%'        THEN 'Internship'
      WHEN `certificate_type` LIKE '%Participation%' THEN 'Participation'
      WHEN `certificate_type` LIKE '%Workshop%'      THEN 'Participation'
      WHEN `certificate_type` LIKE '%Event%'         THEN 'Participation'
      WHEN `certificate_type` LIKE '%Achievement%'   THEN 'Achievement'
      ELSE 'Completion' END;

-- Audit log: IP is now stored as a one-way hash, so the column no longer needs to hold a raw IP
-- (no change needed; VARCHAR(45) is large enough).
