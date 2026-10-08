const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function getHtmlFiles(dir, list = []) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== '.git' && f !== 'node_modules' && f !== 'scratch') getHtmlFiles(full, list);
    } else if (f.endsWith('.html')) {
      list.push(full);
    }
  });
  return list;
}

const htmlFiles = getHtmlFiles(ROOT_DIR);

htmlFiles.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (c.includes('content="https://vyomantratech.com/solutions/ai-solutions">>')) {
    c = c.replace('content="https://vyomantratech.com/solutions/ai-solutions">>', 'content="https://vyomantratech.com/solutions/ai-solutions">');
    changed = true;
    console.log('Fixed double > in solutions/ai-solutions.html');
  }

  // Also check any generic ">>"
  const doubleBracketRegex = /<meta\s+property=["']og:[^"']+["']\s+content=["'][^"']+["']>>/gi;
  if (doubleBracketRegex.test(c)) {
    c = c.replace(doubleBracketRegex, match => match.replace('>>', '>'));
    changed = true;
    console.log(`Fixed double > in ${file}`);
  }

  // Title fix for ai-solutions
  if (file.endsWith('solutions\\ai-solutions.html') || file.endsWith('solutions/ai-solutions.html')) {
    c = c.replace(
      '<title>Enterprise AI Solutions &amp; Intelligent Systems | VYOMANTRA TECHNOLOGIES</title>',
      '<title>Enterprise AI Solutions &amp; Systems | Vyomantra Technologies</title>'
    );
    changed = true;
    console.log('Updated title in solutions/ai-solutions.html');
  }

  if (changed) {
    fs.writeFileSync(file, c, 'utf8');
  }
});
