// fix-media-paths.cjs
const fs = require('fs');
const meta = JSON.parse(fs.readFileSync('uploads/media.json', 'utf-8'));
let fixed = 0;
meta.forEach(m => {
  if (m.url && m.url.startsWith('/public/')) {
    m.url = m.url.replace('/public/', '/');
    fixed++;
  }
});
fs.writeFileSync('uploads/media.json', JSON.stringify(meta, null, 2));
console.log('Fixed ' + fixed + ' of ' + meta.length + ' media paths');
