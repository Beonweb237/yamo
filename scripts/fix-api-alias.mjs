import fs from 'fs';

const path = '/home/ubuntu/miamexpress/server/src/index.js';
let code = fs.readFileSync(path, 'utf-8');

const oldLine = 'const { table } = req.params;';
const newLines = `const { table: rawTable } = req.params;
    const TABLE_ALIASES = { restaurant_reviews: 'reviews' };
    const table = TABLE_ALIASES[rawTable] || rawTable;`;

if (code.includes(oldLine)) {
  code = code.replace(oldLine, newLines);
  fs.writeFileSync(path, code, 'utf-8');
  console.log('OK: alias restaurant_reviews -> reviews added');
} else {
  console.log('Pattern not found. Current handleList:');
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('async function handleList')) {
      for (let j = i; j < Math.min(i + 8, lines.length); j++) {
        console.log((j + 1) + ': ' + lines[j]);
      }
      break;
    }
  }
}
