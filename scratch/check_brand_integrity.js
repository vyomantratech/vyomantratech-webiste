const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function walk(dir, list = []) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== '.git' && f !== 'node_modules' && f !== 'scratch') walk(full, list);
    } else {
      if (!f.endsWith('.txt') && !f.endsWith('.md')) {
        list.push(full);
      }
    }
  });
  return list;
}

const files = walk(ROOT_DIR);
let findings = [];

files.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const c = fs.readFileSync(file, 'utf8');
  if (/vyomastra/i.test(c)) {
    findings.push(`Vyomastra in: ${rel}`);
  }
  if (/mind\s*kraft/i.test(c)) {
    findings.push(`Mind Kraft in: ${rel}`);
  }
});

console.log(`Brand Integrity Check: ${findings.length} findings.`);
findings.forEach(f => console.log('  ' + f));
