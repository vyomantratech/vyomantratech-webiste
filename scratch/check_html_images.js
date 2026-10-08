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

let pngReferencedInHtml = [];
let missingDimensions = [];
let missingLazy = [];

htmlFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  const imgRegex = /<img\s+([^>]+)>/gi;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    const attrs = match[1];
    const src = (attrs.match(/src=["'](.*?)["']/i) || [])[1] || '';
    const width = (attrs.match(/width=["'](.*?)["']/i) || [])[1];
    const height = (attrs.match(/height=["'](.*?)["']/i) || [])[1];
    const loading = (attrs.match(/loading=["'](.*?)["']/i) || [])[1];

    if (src.endsWith('.png') && !src.includes('favicon') && !src.includes('logo')) {
      pngReferencedInHtml.push({ file: rel, src });
    }

    if (!width || !height) {
      missingDimensions.push({ file: rel, src });
    }

    if (!loading && !src.includes('logo') && !attrs.includes('hero')) {
      missingLazy.push({ file: rel, src });
    }
  }
});

console.log(`PNGs referenced in HTML: ${pngReferencedInHtml.length}`);
pngReferencedInHtml.slice(0, 10).forEach(p => console.log(`  ${p.file} -> ${p.src}`));

console.log(`Missing dimensions: ${missingDimensions.length}`);
missingDimensions.slice(0, 10).forEach(m => console.log(`  ${m.file} -> ${m.src}`));

console.log(`Missing lazy loading: ${missingLazy.length}`);
missingLazy.slice(0, 10).forEach(l => console.log(`  ${l.file} -> ${l.src}`));
