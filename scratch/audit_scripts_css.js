const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));

console.log('=== SCRIPTS & STYLESHEETS AUDIT ===');

const pageAssets = {};

raw.forEach(p => {
  const content = fs.readFileSync(path.join(ROOT_DIR, p.file), 'utf8');
  
  const scripts = [...content.matchAll(/<script[^>]*src=["'](.*?)["'][^>]*>/gi)].map(m => m[1]);
  const styles = [...content.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["'](.*?)["'][^>]*>/gi)].map(m => m[1]);
  const fonts = [...content.matchAll(/<link[^>]*href=["'](https:\/\/fonts\.googleapis\.com[^"']+)["'][^>]*>/gi)].map(m => m[1]);

  pageAssets[p.file] = { scripts, styles, fonts };
});

console.log('Index.html assets:');
console.log(JSON.stringify(pageAssets['index.html'], null, 2));

console.log('\nUnique scripts loaded across all pages:');
const allScripts = new Set();
Object.values(pageAssets).forEach(a => a.scripts.forEach(s => allScripts.add(s)));
console.log(Array.from(allScripts));

console.log('\nUnique stylesheets loaded across all pages:');
const allStyles = new Set();
Object.values(pageAssets).forEach(a => a.styles.forEach(s => allStyles.add(s)));
console.log(Array.from(allStyles));
