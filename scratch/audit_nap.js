const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));

console.log('=== NAP & LOCAL SEO AUDIT ===');

const napFindings = [];

raw.forEach(p => {
  const content = fs.readFileSync(path.join(ROOT_DIR, p.file), 'utf8');

  const hasDharmapuri = /Dharmapuri/i.test(content);
  const hasTamilNadu = /Tamil\s*Nadu/i.test(content);
  const hasPhone = /81222\s*88855|8122288855/.test(content);
  const hasEmail = /vyomantratech@gmail\.com/i.test(content);
  const hasPin = /636701/.test(content);

  napFindings.push({
    file: p.file,
    hasDharmapuri,
    hasTamilNadu,
    hasPhone,
    hasEmail,
    hasPin
  });
});

console.log('Pages mentioning Dharmapuri:', napFindings.filter(n => n.hasDharmapuri).length);
console.log('Pages mentioning Tamil Nadu:', napFindings.filter(n => n.hasTamilNadu).length);
console.log('Pages mentioning Phone:', napFindings.filter(n => n.hasPhone).length);
console.log('Pages mentioning Email:', napFindings.filter(n => n.hasEmail).length);
console.log('Pages mentioning PIN 636701:', napFindings.filter(n => n.hasPin).length);

// Check contact.html details
const contact = raw.find(r => r.file === 'contact.html');
console.log('Contact page JSON-LD:');
contact.jsonLdScripts.forEach(s => {
  console.log(JSON.stringify(s.data, null, 2));
});
