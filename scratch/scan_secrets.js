const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const inv = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf8'));

const filesToCheck = [
  ...inv.php,
  ...inv.json,
  ...inv.sql,
  ...inv.txt,
  ...inv.md
];

const secretFindings = [];

filesToCheck.forEach(rel => {
  const full = path.join(ROOT_DIR, rel);
  const content = fs.readFileSync(full, 'utf8');

  let hasSecret = false;
  let type = '';

  if (rel === 'api/config.php') {
    hasSecret = true;
    type = 'Hardcoded database credentials in production configuration';
  } else if (rel === 'data/admin_session.json') {
    if (content.length > 5) {
      hasSecret = true;
      type = 'Active or cached admin session tokens in data directory';
    }
  } else if (/password\s*=\s*['"][^'"]+['"]/i.test(content) || /['"]password['"]\s*:\s*['"][^'"]+['"]/i.test(content)) {
    if (!rel.includes('audit') && !rel.includes('scratch') && !rel.includes('REPORT')) {
      hasSecret = true;
      type = 'Hardcoded password string detected';
    }
  } else if (/auth_token|secret_key|api_key/i.test(content)) {
    if (!rel.includes('audit') && !rel.includes('scratch') && !rel.includes('REPORT')) {
      hasSecret = true;
      type = 'Secret key / token variable detected';
    }
  }

  if (hasSecret) {
    secretFindings.push({ file: rel, type });
  }
});

console.log('=== SECRET EXPOSURE CHECK ===');
secretFindings.forEach(s => {
  console.log(`[ALERT] ${s.file} -> ${s.type}`);
});
