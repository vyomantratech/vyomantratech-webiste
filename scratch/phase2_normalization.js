const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to list all HTML files
function getHtmlFiles(dir, list = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== '.git' && item !== 'node_modules' && item !== 'scratch') {
        getHtmlFiles(full, list);
      }
    } else if (item.endsWith('.html')) {
      list.push(full);
    }
  }
  return list;
}

const htmlFiles = getHtmlFiles(ROOT_DIR);
console.log(`Phase 2: Scanning ${htmlFiles.length} HTML files...`);

let ogModified = 0;
let adminLinkRemoved = 0;
let verifyLinkFixed = 0;

htmlFiles.forEach(filePath => {
  const rel = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Normalize og:url
  // Find <meta property="og:url" content="...">
  const ogUrlRegex = /<meta\s+property=["']og:url["']\s+content=["'](.*?)["']/gi;
  content = content.replace(ogUrlRegex, (match, url) => {
    let cleanUrl = url;
    if (cleanUrl.endsWith('.html')) {
      cleanUrl = cleanUrl.replace(/\.html$/, '');
      changed = true;
      ogModified++;
    }
    // Also ensure https://vyomantratech.com/
    if (cleanUrl.includes('www.vyomantratech.com')) {
      cleanUrl = cleanUrl.replace('www.vyomantratech.com', 'vyomantratech.com');
      changed = true;
    }
    return `<meta property="og:url" content="${cleanUrl}">`;
  });

  // Also check <meta content="..." property="og:url">
  const ogUrlRevRegex = /<meta\s+content=["'](.*?)["']\s+property=["']og:url["']/gi;
  content = content.replace(ogUrlRevRegex, (match, url) => {
    let cleanUrl = url;
    if (cleanUrl.endsWith('.html')) {
      cleanUrl = cleanUrl.replace(/\.html$/, '');
      changed = true;
      ogModified++;
    }
    return `<meta property="og:url" content="${cleanUrl}">`;
  });

  // 2. Remove Admin link from public footers
  // Pattern: <a href="admin/index.html" ...>...Admin...</a> or similar
  // Examples:
  // <a href="admin/index.html" style="color:var(--text-dim); opacity: 0.6; transition: opacity 0.2s;" title="Staff &amp; Admin Access"><i class="fas fa-lock" style="font-size:0.7rem; margin-right:4px;"></i>Admin</a>
  if (content.includes('admin/index.html') && !rel.startsWith('admin/')) {
    // Regex for the admin link tag
    const adminLinkRegex = /<a\s+href=["'](?:\.\.\/)?admin\/index\.html["'][^>]*>[\s\S]*?<\/a>\s*/gi;
    if (adminLinkRegex.test(content)) {
      content = content.replace(adminLinkRegex, '');
      changed = true;
      adminLinkRemoved++;
      console.log(`Removed admin link from: ${rel}`);
    }
  }

  // 3. Normalize verify link in index.html or other public pages
  // verify/index.html -> /verify
  if (content.includes('verify/index.html')) {
    content = content.replace(/href=["'](?:\.\.\/)?verify\/index\.html["']/g, 'href="/verify"');
    changed = true;
    verifyLinkFixed++;
    console.log(`Normalized verify link in: ${rel}`);
  }

  // 4. Update verify/index.html if missing metadata or canonical
  if (rel === 'verify/index.html') {
    if (!content.includes('rel="canonical"')) {
      // Add canonical and meta description before </head>
      const metaSnippet = `  <meta name="description" content="Verify the authenticity of cryptographic certificates and credentials issued by Vyomantra Technologies.">\n  <link rel="canonical" href="https://vyomantratech.com/verify">\n</head>`;
      content = content.replace(/<\/head>/i, metaSnippet);
      changed = true;
      console.log('Added canonical and description to verify/index.html');
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
});

// Update api/admin/job-builder.php
const jobBuilderPath = path.join(ROOT_DIR, 'api', 'admin', 'job-builder.php');
if (fs.existsSync(jobBuilderPath)) {
  let jbContent = fs.readFileSync(jobBuilderPath, 'utf8');
  let jbChanged = false;
  if (jbContent.includes('/privacy-policy')) {
    jbContent = jbContent.replace(/\/privacy-policy/g, '/privacy');
    jbChanged = true;
  }
  if (jbContent.includes('/terms-and-conditions')) {
    jbContent = jbContent.replace(/\/terms-and-conditions/g, '/terms');
    jbChanged = true;
  }
  if (jbChanged) {
    fs.writeFileSync(jobBuilderPath, jbContent, 'utf8');
    console.log('Updated api/admin/job-builder.php: normalized footer links to /privacy and /terms');
  }
}

console.log(`Phase 2 complete: og:url updated in ${ogModified} instances, admin links removed in ${adminLinkRemoved} pages, verify links normalized in ${verifyLinkFixed} pages.`);
