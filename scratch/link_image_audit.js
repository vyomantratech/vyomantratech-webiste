const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));

// 1. LINK AUDIT
console.log('=== LINK AUDIT ===');
const linkIssues = [];
const internalLinkGraph = {}; // page -> set of target URLs

raw.forEach(page => {
  const file = page.file;
  internalLinkGraph[file] = new Set();

  page.links.forEach(l => {
    const href = l.href.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return;
    }

    // Check for .html in internal links
    if (href.includes('.html') && !href.startsWith('http://') && !href.startsWith('https://')) {
      linkIssues.push({ file, href, type: 'Internal link contains .html' });
    } else if (href.includes('vyomantratech.com') && href.includes('.html')) {
      linkIssues.push({ file, href, type: 'Internal absolute link contains .html' });
    }

    // Check for www.vyomantratech.com
    if (href.includes('www.vyomantratech.com')) {
      linkIssues.push({ file, href, type: 'Link contains www' });
    }

    // Check for http://vyomantratech.com
    if (href.startsWith('http://vyomantratech.com')) {
      linkIssues.push({ file, href, type: 'Link contains http instead of https' });
    }

    // Record internal link
    if (href.startsWith('/') || href.startsWith('https://vyomantratech.com')) {
      const cleanHref = href.replace('https://vyomantratech.com', '').split('#')[0].split('?')[0];
      internalLinkGraph[file].add(cleanHref || '/');
    }
  });
});

console.log(`Total link issues found: ${linkIssues.length}`);
linkIssues.forEach(i => console.log(`  [${i.type}] in ${i.file} -> ${i.href}`));

// 2. IMAGE AUDIT
console.log('\n=== IMAGE AUDIT ===');
const imageIssues = [];
const externalImages = [];
let totalImages = 0;
let missingAltCount = 0;
let emptyAltCount = 0;
let missingLazyCount = 0;
let missingDimensionsCount = 0;

raw.forEach(page => {
  page.images.forEach(img => {
    totalImages++;
    if (img.alt === undefined) {
      missingAltCount++;
      imageIssues.push({ file: page.file, src: img.src, issue: 'Missing alt attribute entirely' });
    } else if (img.alt === '') {
      emptyAltCount++;
    }

    if (!img.loading) {
      missingLazyCount++;
    }

    if (!img.width || !img.height) {
      missingDimensionsCount++;
    }

    if (img.src.startsWith('http://') || img.src.startsWith('https://')) {
      if (!img.src.includes('vyomantratech.com')) {
        externalImages.push({ file: page.file, src: img.src });
      }
    }
  });
});

console.log(`Total images scanned: ${totalImages}`);
console.log(`Missing alt: ${missingAltCount}`);
console.log(`Empty alt (decorative/unspecified): ${emptyAltCount}`);
console.log(`Missing loading="lazy": ${missingLazyCount}`);
console.log(`Missing width/height: ${missingDimensionsCount}`);
console.log(`External image URLs: ${externalImages.length}`);
if (externalImages.length > 0) {
  console.log('Sample external images:');
  externalImages.slice(0, 10).forEach(e => console.log(`  ${e.file} -> ${e.src}`));
}

// 3. OPEN GRAPH & TWITTER AUDIT
console.log('\n=== SOCIAL META AUDIT ===');
const socialIssues = [];
raw.forEach(p => {
  const issues = [];
  if (!p.og.ogTitle) issues.push('Missing og:title');
  if (!p.og.ogDesc) issues.push('Missing og:description');
  if (!p.og.ogUrl) issues.push('Missing og:url');
  else if (p.og.ogUrl.includes('.html')) issues.push('og:url contains .html');
  else if (p.og.ogUrl.includes('www.')) issues.push('og:url contains www');
  if (!p.og.ogImage) issues.push('Missing og:image');
  if (!p.twitter.twCard) issues.push('Missing twitter:card');

  if (issues.length > 0) {
    socialIssues.push({ file: p.file, issues });
  }
});
console.log(`Pages with social meta issues: ${socialIssues.length}`);
socialIssues.forEach(s => console.log(`  ${s.file}: ${s.issues.join(', ')}`));

// 4. BRAND STRING AUDIT
console.log('\n=== BRAND STRING AUDIT ===');
raw.forEach(p => {
  const b = p.brandStats;
  if (b.vyomastra > 0 || b.mindkraft > 0 || b.vyomantraTechCaps > 5) {
    console.log(`  ${p.file}: Caps=${b.vyomantraTechCaps}, Mixed=${b.vyomantraTechMixed}, Vyomastra=${b.vyomastra}, MindKraft=${b.mindkraft}`);
  }
});

fs.writeFileSync(path.join(__dirname, 'links_images_social_summary.json'), JSON.stringify({
  linkIssues,
  externalImages,
  socialIssues,
  totalImages,
  missingAltCount,
  emptyAltCount,
  missingLazyCount,
  missingDimensionsCount
}, null, 2));
