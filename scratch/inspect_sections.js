const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));

// Filter pages of interest
const interesting = raw.filter(p => 
  p.file.startsWith('solutions/') || 
  p.file.startsWith('products/') || 
  p.file.startsWith('portfolio/') ||
  ['solutions.html', 'products.html', 'portfolio.html', 'projects.html', 'privacy.html', 'privacy-policy.html', 'terms.html', 'terms-and-conditions.html', 'refund-policy.html', 'request-a-quote.html', 'gallery.html'].includes(p.file)
);

interesting.forEach(p => {
  console.log(`\n========================================`);
  console.log(`FILE: ${p.file}`);
  console.log(`TITLE: ${p.title}`);
  console.log(`CANONICAL: ${p.canonical}`);
  console.log(`H1: ${JSON.stringify(p.h1)}`);
  console.log(`ROBOTS: ${p.robotsMeta}`);
  console.log(`OG:URL: ${p.og.ogUrl}`);
  console.log(`SCHEMA COUNT: ${p.jsonLdCount}`);
  if (p.jsonLdCount > 0) {
    p.jsonLdScripts.forEach(s => {
      console.log(`  SCHEMA: ${JSON.stringify(s.data).slice(0, 200)}...`);
    });
  }
});
