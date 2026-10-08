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
console.log(`Total HTML files scanned: ${htmlFiles.length}`);

let issues = [];

htmlFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  // Check canonical
  const canMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i);
  if (!canMatch && !rel.startsWith('admin/')) {
    issues.push(`[CANONICAL MISSING] ${rel}`);
  } else if (canMatch) {
    if (canMatch[1].includes('.html')) issues.push(`[.HTML IN CANONICAL] ${rel}: ${canMatch[1]}`);
    if (canMatch[1].includes('www.')) issues.push(`[WWW IN CANONICAL] ${rel}: ${canMatch[1]}`);
    if (canMatch[1].startsWith('http://')) issues.push(`[HTTP IN CANONICAL] ${rel}: ${canMatch[1]}`);
  }

  // Check og:url
  const ogMatch = content.match(/<meta\s+property=["']og:url["']\s+content=["'](.*?)["']/i);
  if (ogMatch) {
    if (ogMatch[1].includes('.html')) issues.push(`[.HTML IN OG:URL] ${rel}: ${ogMatch[1]}`);
    if (ogMatch[1].includes('www.')) issues.push(`[WWW IN OG:URL] ${rel}: ${ogMatch[1]}`);
  }

  // Check internal links
  const linkMatches = [...content.matchAll(/href=["'](.*?)["']/gi)].map(m => m[1]);
  linkMatches.forEach(href => {
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (href.startsWith('http') && !href.includes('vyomantratech.com')) return;
    if (href.includes('.html') && !rel.startsWith('admin/')) {
      issues.push(`[.HTML INTERNAL LINK] in ${rel} -> ${href}`);
    }
    if (href.includes('admin/index.html') && !rel.startsWith('admin/')) {
      issues.push(`[ADMIN LINK LEAK] in ${rel} -> ${href}`);
    }
  });

  // Check H1
  const h1Matches = [...content.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (!rel.startsWith('admin/') && rel !== 'verify/index.html') {
    if (h1Matches.length === 0) issues.push(`[MISSING H1] in ${rel}`);
    if (h1Matches.length > 1) issues.push(`[MULTIPLE H1 (${h1Matches.length})] in ${rel}`);
  }
});

console.log(`System Validation Scan: ${issues.length} issues found.`);
issues.forEach(i => console.log('  ' + i));
