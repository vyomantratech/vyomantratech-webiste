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
const imageUsage = {}; // imagePath -> [files]

htmlFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const matches = [...content.matchAll(/src=["']([^"']+\.(?:png|jpg|jpeg|webp|svg))["']/gi)].map(m => m[1]);
  matches.forEach(src => {
    const cleanSrc = src.replace(/^\.\.\//, '').replace(/^\//, '');
    imageUsage[cleanSrc] = imageUsage[cleanSrc] || [];
    if (!imageUsage[cleanSrc].includes(rel)) {
      imageUsage[cleanSrc].push(rel);
    }
  });
});

console.log('Unique images referenced in HTML:', Object.keys(imageUsage).length);
console.log('Sample image references:');
Object.entries(imageUsage).slice(0, 20).forEach(([img, pages]) => {
  console.log(`  ${img} (used in ${pages.length} pages): ${pages.slice(0, 3).join(', ')}`);
});

fs.writeFileSync(path.join(__dirname, 'image_usage.json'), JSON.stringify(imageUsage, null, 2));
