const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbUrl = config.databaseUrl || '';
const isCloudDb = dbUrl.includes('supabase') || dbUrl.includes('neon') || dbUrl.includes('render') || dbUrl.includes('amazonaws') || dbUrl.includes('sslmode=require');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

async function initDb() {
  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('[DB] Database schema and migrations applied successfully');
  } catch (err) {
    console.error('[DB] Error initializing database schema:', err.message);
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb,
};
