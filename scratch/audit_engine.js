const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to recursively list files
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== '.git' && file !== 'node_modules') {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getAllFiles(ROOT_DIR);
console.log(`Total files found (excluding .git): ${allFiles.length}`);

// Categorize files
const inventory = {
  html: [],
  css: [],
  js: [],
  php: [],
  json: [],
  sql: [],
  xml: [],
  txt: [],
  md: [],
  images: [],
  fonts: [],
  htaccess: [],
  other: []
};

allFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const ext = path.extname(file).toLowerCase();
  const basename = path.basename(file).toLowerCase();

  if (basename === '.htaccess') inventory.htaccess.push(rel);
  else if (ext === '.html') inventory.html.push(rel);
  else if (ext === '.css') inventory.css.push(rel);
  else if (ext === '.js') inventory.js.push(rel);
  else if (ext === '.php') inventory.php.push(rel);
  else if (ext === '.json') inventory.json.push(rel);
  else if (ext === '.sql') inventory.sql.push(rel);
  else if (ext === '.xml') inventory.xml.push(rel);
  else if (ext === '.txt') inventory.txt.push(rel);
  else if (ext === '.md') inventory.md.push(rel);
  else if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'].includes(ext)) inventory.images.push(rel);
  else if (['.woff', '.woff2', '.ttf', '.eot'].includes(ext)) inventory.fonts.push(rel);
  else inventory.other.push(rel);
});

console.log('File inventory summary:');
for (const [k, v] of Object.entries(inventory)) {
  console.log(`  ${k}: ${v.length}`);
}

fs.writeFileSync(path.join(__dirname, 'inventory.json'), JSON.stringify(inventory, null, 2));
