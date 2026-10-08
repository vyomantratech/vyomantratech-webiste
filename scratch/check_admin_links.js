const fs = require('fs');

['index.html', 'contact.html', 'services.html', 'careers.html', 'courses.html'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  content.split('\n').forEach((l, idx) => {
    if (l.includes('admin/index.html') || l.includes('verify/index.html')) {
      console.log(`${f}:${idx+1}: ${l.trim()}`);
    }
  });
});
