const fs = require('fs');

const files = [
  'src/components/Navbar.tsx',
  'src/components/MobileBottomNav.tsx',
  'src/components/GlobalSearch.tsx',
  'src/pages/Home.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace t('key', 'Value') or t("key", "Value") with t('Value')
  // We match t( followed by a string (the key), a comma, and another string (the default text)
  content = content.replace(/t\(\s*['"][a-zA-Z0-9_\.]+['"]\s*,\s*['"](.*?)['"]\s*\)/g, 't("$1")');
  content = content.replace(/t\(\s*['"][a-zA-Z0-9_\.]+['"]\s*,\s*`(.*?)`\s*\)/g, 't(`$1`)');
  
  fs.writeFileSync(file, content);
  console.log(`Fixed ${file}`);
});

// Now let's wipe fr.json to remove overrides
const frPath = 'src/i18n/locales/fr.json';
if (fs.existsSync(frPath)) {
  fs.writeFileSync(frPath, '{}');
  console.log('Wiped fr.json overrides.');
}
