const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));
const sitemapXml = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(m => m[1].trim());

console.log(`=== SITEMAP URLS: ${sitemapUrls.length} ===`);

// Categorize HTML files
const fileCategories = {
  publicMain: [
    'index.html', 'about.html', 'services.html', 'solutions.html', 'products.html',
    'portfolio.html', 'courses.html', 'careers.html', 'contact.html', 'gallery.html',
    'request-a-quote.html', 'privacy.html', 'terms.html', 'refund-policy.html'
  ],
  servicesDetail: raw.filter(r => r.file.startsWith('services/') && r.file !== 'services/index.html').map(r => r.file),
  solutionsDetail: raw.filter(r => r.file.startsWith('solutions/') && r.file !== 'solutions/index.html').map(r => r.file),
  productsDetail: raw.filter(r => r.file.startsWith('products/') && r.file !== 'products/index.html').map(r => r.file),
  portfolioDetail: raw.filter(r => r.file.startsWith('portfolio/') && r.file !== 'portfolio/index.html').map(r => r.file),
  shadowedSubIndex: [
    'services/index.html', 'solutions/index.html', 'careers/index.html',
    'portfolio/index.html', 'products/index.html'
  ],
  duplicateLegalOrOld: [
    'privacy-policy.html', 'terms-and-conditions.html', 'projects.html'
  ],
  adminOrVerify: [
    'admin/index.html', 'admin/dashboard.html', 'verify/index.html'
  ]
};

console.log('File categorization:');
for (const [k, v] of Object.entries(fileCategories)) {
  console.log(`  ${k}: ${v.length} files`);
}

// 1. CANONICAL AUDIT
const canonicalAudit = raw.map(page => {
  const file = page.file;
  const canonical = page.canonical;
  let status = 'PASS';
  let issues = [];

  if (!canonical) {
    status = 'FAIL';
    issues.push('Missing canonical tag');
  } else {
    if (canonical.includes('.html')) {
      status = 'FAIL';
      issues.push('.html in canonical');
    }
    if (canonical.includes('www.vyomantratech.com')) {
      status = 'FAIL';
      issues.push('www in canonical');
    }
    if (canonical.startsWith('http://')) {
      status = 'FAIL';
      issues.push('HTTP in canonical');
    }
  }

  return { file, canonical, status, issues };
});

const failedCanonicals = canonicalAudit.filter(c => c.status === 'FAIL');
console.log(`\n=== CANONICAL AUDIT ===\nTotal: ${canonicalAudit.length}, Failed: ${failedCanonicals.length}`);
failedCanonicals.forEach(f => console.log(`  ${f.file}: ${f.issues.join(', ')} (${f.canonical})`));

// 2. SITEMAP AUDIT
// Check if sitemap URLs map to actual files
console.log('\n=== SITEMAP MAPPING ===');
const sitemapIssues = [];
sitemapUrls.forEach(url => {
  // convert url to file path
  let rel = url.replace('https://vyomantratech.com', '');
  if (rel === '' || rel === '/') rel = '/index';
  let filePath = path.join(ROOT_DIR, rel.slice(1) + '.html');
  if (!fs.existsSync(filePath)) {
    // check if it's directory
    let dirIndexPath = path.join(ROOT_DIR, rel.slice(1), 'index.html');
    if (fs.existsSync(dirIndexPath)) {
      sitemapIssues.push({ url, issue: `Maps to dir index: ${dirIndexPath}` });
    } else {
      sitemapIssues.push({ url, issue: `File not found: ${filePath}` });
    }
  }
});
console.log(`Sitemap issues: ${sitemapIssues.length}`);
sitemapIssues.forEach(i => console.log(`  ${i.url}: ${i.issue}`));

// Check which public files are missing from sitemap
const publicFiles = [
  ...fileCategories.publicMain,
  ...fileCategories.servicesDetail,
  ...fileCategories.solutionsDetail,
  ...fileCategories.productsDetail,
  ...fileCategories.portfolioDetail
];

const missingFromSitemap = [];
publicFiles.forEach(f => {
  // compute canonical URL
  let slug = f.replace('.html', '');
  if (slug === 'index') slug = '';
  const expectedUrl = `https://vyomantratech.com${slug === '' ? '/' : '/' + slug}`;
  if (!sitemapUrls.includes(expectedUrl)) {
    missingFromSitemap.push({ file: f, expectedUrl });
  }
});
console.log(`Public files missing from sitemap: ${missingFromSitemap.length}`);
missingFromSitemap.forEach(m => console.log(`  ${m.file} -> ${m.expectedUrl}`));

// 3. TITLE & DESCRIPTION AUDIT
console.log('\n=== TITLE & DESCRIPTION AUDIT ===');
const titleDescIssues = [];
raw.forEach(p => {
  const issues = [];
  if (!p.title) issues.push('Missing Title');
  else if (p.title.length < 20) issues.push(`Short Title (${p.title.length} chars)`);
  else if (p.title.length > 70) issues.push(`Long Title (${p.title.length} chars)`);

  if (!p.metaDescription) issues.push('Missing Meta Description');
  else if (p.metaDescription.length < 50) issues.push(`Short Description (${p.metaDescription.length} chars)`);
  else if (p.metaDescription.length > 170) issues.push(`Long Description (${p.metaDescription.length} chars)`);

  if (issues.length > 0) {
    titleDescIssues.push({ file: p.file, issues, title: p.title, descLen: p.metaDescription ? p.metaDescription.length : 0 });
  }
});
console.log(`Pages with title/desc issues: ${titleDescIssues.length}`);
titleDescIssues.forEach(t => console.log(`  ${t.file}: ${t.issues.join('; ')}`));

// 4. HEADING AUDIT
console.log('\n=== HEADING AUDIT ===');
const headingIssues = [];
raw.forEach(p => {
  const issues = [];
  if (p.h1.length === 0) issues.push('Missing H1');
  if (p.h1.length > 1) issues.push(`Multiple H1 (${p.h1.length})`);
  if (issues.length > 0) {
    headingIssues.push({ file: p.file, issues, h1s: p.h1 });
  }
});
console.log(`Pages with H1 issues: ${headingIssues.length}`);
headingIssues.forEach(h => console.log(`  ${h.file}: ${h.issues.join('; ')} -> H1s: ${JSON.stringify(h.h1s)}`));

// 5. STRUCTURED DATA AUDIT
console.log('\n=== STRUCTURED DATA AUDIT ===');
const schemaAudit = raw.map(p => {
  return {
    file: p.file,
    count: p.jsonLdCount,
    types: p.jsonLdScripts.flatMap(s => {
      if (!s.valid) return ['INVALID_JSON'];
      if (s.data['@graph']) return s.data['@graph'].map(g => g['@type']);
      return [s.data['@type']];
    })
  };
});
schemaAudit.forEach(s => {
  console.log(`  ${s.file}: ${s.count} blocks -> ${s.types.join(', ')}`);
});

fs.writeFileSync(path.join(__dirname, 'analyzed_summary.json'), JSON.stringify({
  canonicalAudit,
  sitemapIssues,
  missingFromSitemap,
  titleDescIssues,
  headingIssues,
  schemaAudit
}, null, 2));
