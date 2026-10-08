const fs = require('fs');

let c = fs.readFileSync('gallery.html', 'utf8');
c = c.replace(/<img\s+src=["'](https:\/\/images\.unsplash\.com[^"']+)["']\s+alt=["']([^"']+)["']\s+decoding=["']async["']\s+loading=["']lazy["']>/gi,
  '<img src="$1" alt="$2" width="800" height="600" decoding="async" loading="lazy">');
fs.writeFileSync('gallery.html', c, 'utf8');
console.log('Updated gallery.html image dimensions successfully.');
