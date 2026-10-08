const fs = require('fs');

function compareFiles(f1, f2) {
  const c1 = fs.readFileSync(f1, 'utf8');
  const c2 = fs.readFileSync(f2, 'utf8');
  console.log(`Comparing ${f1} (${c1.length} bytes) vs ${f2} (${c2.length} bytes)`);
  console.log(`Exact match: ${c1 === c2}`);
}

compareFiles('privacy.html', 'privacy-policy.html');
compareFiles('terms.html', 'terms-and-conditions.html');
compareFiles('portfolio.html', 'projects.html');
compareFiles('portfolio.html', 'portfolio/index.html');
compareFiles('products.html', 'products/index.html');
compareFiles('services.html', 'services/index.html');
compareFiles('solutions.html', 'solutions/index.html');
