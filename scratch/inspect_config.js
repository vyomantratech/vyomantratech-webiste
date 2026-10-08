const fs = require('fs');

const content = fs.readFileSync('api/config.php', 'utf8');
const lines = content.split('\n');

console.log('Total lines in api/config.php:', lines.length);
lines.forEach((l, idx) => {
  const trimmed = l.trim();
  if (trimmed.startsWith('define(')) {
    const key = trimmed.match(/define\(['"](.*?)['"]/);
    console.log(`Line ${idx+1}: define ${key ? key[1] : 'unknown'}`);
  } else if (trimmed.startsWith('function ')) {
    console.log(`Line ${idx+1}: ${trimmed.slice(0, 40)}`);
  }
});
