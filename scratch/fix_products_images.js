const fs = require('fs');

let c = fs.readFileSync('products.html', 'utf8');

c = c.replace(
  'alt="Web Architecture" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy">',
  'alt="Web Architecture" width="800" height="533" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy">'
);

c = c.replace(
  'alt="E-Commerce" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy">',
  'alt="E-Commerce" width="800" height="533" style="width: 100%; height: 100%; object-fit: cover;" decoding="async" loading="lazy">'
);

fs.writeFileSync('products.html', c, 'utf8');
console.log('Updated products.html image dimensions successfully.');
