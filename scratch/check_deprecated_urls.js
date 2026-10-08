const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));

console.log('=== CHECKING DEPRECATED URL REFERENCES IN HTML ===');

const deprecatedPatterns = ['/privacy-policy', '/terms-and-conditions', '/projects'];

raw.forEach(p => {
  const content = fs.readFileSync(path.join(ROOT_DIR, p.file), 'utf8');
  deprecatedPatterns.forEach(pat => {
    if (content.includes(`"${pat}"`) || content.includes(`'${pat}'`) || content.includes(`href="${pat}"`)) {
      console.log(`Found ${pat} in ${p.file}`);
    }
  });
});
