const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const inv = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf8'));

const codeFiles = [...inv.js, ...inv.php];

codeFiles.forEach(rel => {
  const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
  if (content.includes('/privacy-policy')) console.log(`Found /privacy-policy in ${rel}`);
  if (content.includes('/terms-and-conditions')) console.log(`Found /terms-and-conditions in ${rel}`);
  if (content.includes('/projects')) console.log(`Found /projects in ${rel}`);
  if (content.includes('Vyomastra') || content.includes('vyomastra')) console.log(`Found Vyomastra in ${rel}`);
  if (content.includes('Mind Kraft') || content.includes('mind kraft') || content.includes('MindKraft')) console.log(`Found Mind Kraft in ${rel}`);
});
