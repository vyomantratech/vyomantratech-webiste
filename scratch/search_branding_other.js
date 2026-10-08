const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const inv = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf8'));

const otherFiles = [...inv.css, ...inv.sql, ...inv.json, ...inv.txt, ...inv.md];

otherFiles.forEach(rel => {
  const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
  if (/vyomastra/i.test(content)) console.log(`Found Vyomastra in ${rel}`);
  if (/mind\s*kraft/i.test(content)) console.log(`Found Mind Kraft in ${rel}`);
});
