const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function getHtmlFiles(dir, list = []) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== '.git' && f !== 'node_modules' && f !== 'scratch') getHtmlFiles(full, list);
    } else if (f.endsWith('.html')) {
      list.push(full);
    }
  });
  return list;
}

const htmlFiles = getHtmlFiles(ROOT_DIR);
let ogHtmlCount = 0;
let adminLinkCount = 0;

htmlFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const c = fs.readFileSync(file, 'utf8');

  // Check og:url
  const m = c.match(/<meta\s+property=["']og:url["']\s+content=["'](.*?)["']/i);
  if (m && m[1].includes('.html')) {
    console.log(`[FAIL] ${rel} has og:url: ${m[1]}`);
    ogHtmlCount++;
  }

  // Check public admin links
  if (!rel.startsWith('admin/') && c.includes('admin/index.html')) {
    console.log(`[FAIL] ${rel} still has admin/index.html link`);
    adminLinkCount++;
  }
});

console.log(`Validation Phase 2:`);
console.log(`  og:url with .html: ${ogHtmlCount} (Expected: 0)`);
console.log(`  Public admin links: ${adminLinkCount} (Expected: 0)`);
