const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const inv = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf8'));

console.log('=== ASSET SIZES & PERFORMANCE AUDIT ===');

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// CSS sizes
console.log('\n--- CSS FILES ---');
inv.css.forEach(f => {
  const stat = fs.statSync(path.join(ROOT_DIR, f));
  console.log(`  ${f}: ${formatBytes(stat.size)}`);
});

// JS sizes
console.log('\n--- JS FILES ---');
inv.js.forEach(f => {
  const stat = fs.statSync(path.join(ROOT_DIR, f));
  console.log(`  ${f}: ${formatBytes(stat.size)}`);
});

// Image summary
console.log('\n--- IMAGE FILES SUMMARY ---');
let totalImageBytes = 0;
const imageExtensions = {};
const largeImages = [];

inv.images.forEach(f => {
  const full = path.join(ROOT_DIR, f);
  const stat = fs.statSync(full);
  totalImageBytes += stat.size;
  const ext = path.extname(f).toLowerCase();
  imageExtensions[ext] = (imageExtensions[ext] || 0) + 1;
  if (stat.size > 200 * 1024) { // > 200 KB
    largeImages.push({ file: f, size: stat.size });
  }
});

console.log(`Total local images: ${inv.images.length}, Total size: ${formatBytes(totalImageBytes)}`);
console.log('Format distribution:', imageExtensions);
console.log(`Images over 200 KB: ${largeImages.length}`);
largeImages.sort((a,b) => b.size - a.size).slice(0, 10).forEach(img => {
  console.log(`  ${img.file}: ${formatBytes(img.size)}`);
});
