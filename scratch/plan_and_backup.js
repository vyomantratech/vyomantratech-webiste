const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(__dirname, 'backup_pre_implementation');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 1. Files to be deleted
const filesToDelete = [
  'privacy-policy.html',
  'terms-and-conditions.html',
  'projects.html',
  'services/index.html',
  'solutions/index.html',
  'products/index.html',
  'portfolio/index.html',
  'careers/index.html'
];

// 2. Core files to be modified
const coreFilesToModify = [
  '.htaccess',
  '.gitignore',
  'api/config.php',
  'data/.htaccess',
  'api/admin/jobs.php',
  'api/admin/job-builder.php',
  'data/jobs.json'
];

// 3. Backup all these files
const allBackupTargets = [...filesToDelete, ...coreFilesToModify];

allBackupTargets.forEach(rel => {
  const src = path.join(ROOT_DIR, rel);
  if (fs.existsSync(src)) {
    const dest = path.join(BACKUP_DIR, rel);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Backed up: ${rel}`);
  } else {
    console.log(`Warning: File not found to backup: ${rel}`);
  }
});

console.log('Backup completed successfully.');
