const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'html_audit_raw.json'), 'utf8'));

console.log('=== SOCIAL PROFILES & EXTERNAL CONTACT AUDIT ===');

const socialLinks = new Set();
const contactChannels = {
  phones: new Set(),
  emails: new Set(),
  whatsapps: new Set()
};

raw.forEach(p => {
  p.links.forEach(l => {
    const href = l.href.trim();
    if (href.includes('linkedin.com') || 
        href.includes('instagram.com') || 
        href.includes('facebook.com') || 
        href.includes('twitter.com') || 
        href.includes('x.com') || 
        href.includes('youtube.com') || 
        href.includes('github.com')) {
      socialLinks.add(`${p.file} -> ${href}`);
    }

    if (href.startsWith('tel:')) contactChannels.phones.add(href);
    if (href.startsWith('mailto:')) contactChannels.emails.add(href);
    if (href.includes('wa.me') || href.includes('whatsapp.com')) contactChannels.whatsapps.add(href);
  });
});

console.log(`Unique social links found: ${socialLinks.size}`);
socialLinks.forEach(s => console.log(`  ${s}`));

console.log('\nContact channels:');
console.log('  Phones:', Array.from(contactChannels.phones));
console.log('  Emails:', Array.from(contactChannels.emails));
console.log('  WhatsApps:', Array.from(contactChannels.whatsapps));
