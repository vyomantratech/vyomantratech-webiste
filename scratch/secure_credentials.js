const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const configPath = path.join(ROOT_DIR, 'api', 'config.php');
const localConfigPath = path.join(ROOT_DIR, 'api', 'db-config.local.php');
const gitignorePath = path.join(ROOT_DIR, '.gitignore');
const dataHtaccessPath = path.join(ROOT_DIR, 'data', '.htaccess');

const configContent = fs.readFileSync(configPath, 'utf8');

// Extract DB defines
const hostMatch = configContent.match(/define\(['"]DB_HOST['"],\s*(['"].*?['"])\);/);
const nameMatch = configContent.match(/define\(['"]DB_NAME['"],\s*(['"].*?['"])\);/);
const userMatch = configContent.match(/define\(['"]DB_USER['"],\s*(['"].*?['"])\);/);
const passMatch = configContent.match(/define\(['"]DB_PASS['"],\s*(['"].*?['"])\);/);
const charsetMatch = configContent.match(/define\(['"]DB_CHARSET['"],\s*(['"].*?['"])\);/);

if (!hostMatch || !nameMatch || !userMatch || !passMatch) {
  console.error('Failed to extract DB credentials from api/config.php');
  process.exit(1);
}

// Write api/db-config.local.php
const localConfigCode = `<?php
/**
 * Vyomantra Technologies - Local / Production Database Credentials
 * =================================================================
 * THIS FILE IS EXCLUDED FROM GIT AND MUST NEVER BE COMMITTED.
 * Compatible with Hostinger Shared Web Hosting MySQL.
 */

if (!defined('SITE_URL') && basename($_SERVER['PHP_SELF'] ?? '') === basename(__FILE__)) {
    http_response_code(403);
    exit('Direct access forbidden.');
}

if (!defined('DB_HOST'))    define('DB_HOST', ${hostMatch[1]});
if (!defined('DB_NAME'))    define('DB_NAME', ${nameMatch[1]});
if (!defined('DB_USER'))    define('DB_USER', ${userMatch[1]});
if (!defined('DB_PASS'))    define('DB_PASS', ${passMatch[1]});
if (!defined('DB_CHARSET')) define('DB_CHARSET', ${charsetMatch ? charsetMatch[1] : "'utf8mb4'"});
`;

fs.writeFileSync(localConfigPath, localConfigCode);
console.log('Created untracked api/db-config.local.php successfully.');

// Now replace credential section in api/config.php
const replacement = `// -------------------------------------------------------------
// Database Configuration (Environment / Untracked Local Config)
// -------------------------------------------------------------
// 1. Load untracked local credentials if present (Hostinger / local dev)
$localConfig = __DIR__ . '/db-config.local.php';
if (file_exists($localConfig)) {
    require_once $localConfig;
}

// 2. Check environment variables as fallback
if (!defined('DB_HOST'))    define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
if (!defined('DB_NAME'))    define('DB_NAME', getenv('DB_NAME') ?: getenv('MYSQL_DATABASE') ?: '');
if (!defined('DB_USER'))    define('DB_USER', getenv('DB_USER') ?: getenv('MYSQL_USER') ?: '');
if (!defined('DB_PASS'))    define('DB_PASS', getenv('DB_PASS') ?: getenv('MYSQL_PASSWORD') ?: '');
if (!defined('DB_CHARSET')) define('DB_CHARSET', getenv('DB_CHARSET') ?: 'utf8mb4');`;

const regex = /\/\/\s*-+\r?\n\/\/\s*Hostinger Database Credentials[\s\S]*?define\('DB_CHARSET'[^;]*;\r?\n/m;

if (!regex.test(configContent)) {
  console.error('Could not match credentials block via regex');
  process.exit(1);
}

const newConfigContent = configContent.replace(regex, replacement + '\r\n');
fs.writeFileSync(configPath, newConfigContent);
console.log('Updated api/config.php: hardcoded credentials removed from tracked source.');

// Update .gitignore
let gitignore = fs.readFileSync(gitignorePath, 'utf8');
const gitignoreAdditions = `
# Untracked database and environment credentials
api/db-config.local.php
*.local.php
.env
.env.*
`;

if (!gitignore.includes('db-config.local.php')) {
  gitignore += gitignoreAdditions;
  fs.writeFileSync(gitignorePath, gitignore);
  console.log('Updated .gitignore to exclude api/db-config.local.php and *.local.php.');
}

// Update data/.htaccess to also protect certificate_config.json
let dataHtaccess = fs.readFileSync(dataHtaccessPath, 'utf8');
if (!dataHtaccess.includes('certificate_config')) {
  dataHtaccess = dataHtaccess.replace(
    /FilesMatch "\^\(certificates\|certificate_logs\|admin_session\)\\.json\$"/,
    'FilesMatch "^(certificates|certificate_logs|certificate_config|admin_session)\.json$"'
  );
  fs.writeFileSync(dataHtaccessPath, dataHtaccess);
  console.log('Updated data/.htaccess: certificate_config.json protected.');
}
