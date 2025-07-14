const { Pool } = require('pg');

// Validate required environment variables
const requiredEnvVars = ['POSTGRES_USER', 'DB_HOST', 'POSTGRES_DB', 'POSTGRES_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.DB_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.DB_PORT || 5432,
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 10, // Maximum number of connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // Close idle connections after specified time
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000, // Return error after specified time if connection could not be established
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Database connected successfully');
  console.log(`Pool configuration: max=${pool.options.max}, idleTimeout=${pool.options.idleTimeoutMillis}ms, connectionTimeout=${pool.options.connectionTimeoutMillis}ms`);
  release();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}; 