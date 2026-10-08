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
let totalSchemas = 0;
let parseErrors = 0;
let htmlUrlErrors = 0;
let wwwErrors = 0;

htmlFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  const matches = [...content.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  matches.forEach(m => {
    totalSchemas++;
    try {
      const parsed = JSON.parse(m[1]);
      const jsonStr = JSON.stringify(parsed);
      if (jsonStr.includes('.html')) {
        console.log(`[FAIL] .html in JSON-LD in ${rel}`);
        htmlUrlErrors++;
      }
      if (jsonStr.includes('www.vyomantratech.com')) {
        console.log(`[FAIL] www in JSON-LD in ${rel}`);
        wwwErrors++;
      }
    } catch (e) {
      console.log(`[FAIL] JSON parse error in ${rel}: ${e.message}`);
      parseErrors++;
    }
  });
});

console.log('Phase 3 Validation Results:');
console.log(`  Total Schema Blocks Scanned: ${totalSchemas}`);
console.log(`  JSON Parse Errors:            ${parseErrors} (Expected: 0)`);
console.log(`  .html URL Errors in Schema:   ${htmlUrlErrors} (Expected: 0)`);
console.log(`  www Errors in Schema:         ${wwwErrors} (Expected: 0)`);
