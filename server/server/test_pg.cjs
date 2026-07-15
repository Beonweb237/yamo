const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1', port: 5432, database: 'miamexpress',
  user: 'miamexpress', password: 'MiamexpressDB2026Secure'
});

async function test() {
  try {
    const r = await pool.query('SELECT compute_delivery_fee($1) AS fee', [3.2]);
    console.log('OK:', r.rows[0].fee);
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  pool.end();
}
test();
