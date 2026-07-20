const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync(process.argv[2] || 'admin2026', 10);
console.log(hash);
