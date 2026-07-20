const fs = require('fs');

const extracted = require('./extracted_strings.json');
const enPath = 'src/i18n/locales/en.json';

let enData = {};
if (fs.existsSync(enPath)) {
  enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
}

let added = 0;
extracted.forEach(str => {
  if (!enData[str]) {
    // For now, map to the same string to ensure the site still renders properly.
    // In a real automated setup, this would hit an API.
    enData[str] = str;
    added++;
  }
});

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));
console.log(`Added ${added} new keys to en.json`);
