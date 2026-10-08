const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));

console.log('=== ANALYTICS & TRACKING AUDIT ===');

const trackingFindings = {
  ga4: [],
  gtm: [],
  gscVerification: [],
  metaPixel: [],
  other: []
};

raw.forEach(p => {
  const content = fs.readFileSync(path.join(ROOT_DIR, p.file), 'utf8');

  // GA4: G-XXXXXXX or gtag('config'
  if (/G-[A-Z0-9]{6,}/i.test(content) || /googletagmanager\.com\/gtag\/js/i.test(content)) {
    const match = content.match(/G-[A-Z0-9]+/i);
    trackingFindings.ga4.push({ file: p.file, id: match ? match[0] : 'gtag script' });
  }

  // GTM: GTM-XXXXXXX
  if (/GTM-[A-Z0-9]+/i.test(content)) {
    const match = content.match(/GTM-[A-Z0-9]+/i);
    trackingFindings.gtm.push({ file: p.file, id: match ? match[0] : 'gtm script' });
  }

  // Google Search Console meta: google-site-verification
  if (/name=["']google-site-verification["']/i.test(content)) {
    const match = content.match(/content=["']([^"']+)["']/i);
    trackingFindings.gscVerification.push({ file: p.file, content: match ? match[1] : 'present' });
  }

  // Meta Pixel
  if (/connect\.facebook\.net/i.test(content) || /fbq\(/i.test(content)) {
    trackingFindings.metaPixel.push({ file: p.file });
  }
});

console.log(`GA4 tags found: ${trackingFindings.ga4.length}`);
trackingFindings.ga4.forEach(g => console.log(`  ${g.file} -> ${g.id}`));

console.log(`GTM tags found: ${trackingFindings.gtm.length}`);
trackingFindings.gtm.forEach(g => console.log(`  ${g.file} -> ${g.id}`));

console.log(`GSC verification tags found: ${trackingFindings.gscVerification.length}`);
trackingFindings.gscVerification.forEach(g => console.log(`  ${g.file} -> ${g.content}`));

console.log(`Meta Pixel tags found: ${trackingFindings.metaPixel.length}`);

fs.writeFileSync(path.join(__dirname, 'analytics_summary.json'), JSON.stringify(trackingFindings, null, 2));
