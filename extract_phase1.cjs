const fs = require('fs');

const files = [
  'src/components/Navbar.tsx',
  'src/components/MobileBottomNav.tsx',
  'src/components/GlobalSearch.tsx',
  'src/pages/Home.tsx'
];

let enData = {};
const enPath = 'src/i18n/locales/en.json';
if (fs.existsSync(enPath)) {
  enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
}

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  
  const matches = [...content.matchAll(/t\(\s*["`](.*?)["`]\s*\)/g)];
  matches.forEach(match => {
    const str = match[1];
    if (str && !enData[str]) {
      enData[str] = str;
    }
  });
});

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));
console.log('Added Phase 1 strings to en.json');
