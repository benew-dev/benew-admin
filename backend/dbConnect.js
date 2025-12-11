// backend/dbConnect.js - OPTIMIZED VERSION
import { Pool } from 'pg';

// ===== CONFIGURATION =====

const requiredEnvVars = [
  'USER_NAME',
  'HOST_NAME',
  'DB_NAME',
  'DB_PASSWORD',
  'PORT_NUMBER',
];

// Validation stricte au startup
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`FATAL: Missing required environment variable: ${envVar}`);
  }
});

const getTimestamp = () => new Date().toISOString();

// ===== POOL SINGLETON =====

let pool = null;

function getPoolConfig() {
  return {
    user: process.env.USER_NAME,
    host: process.env.HOST_NAME,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.PORT_NUMBER) || 5432,

    // Config optimisée Vercel Serverless
    max: 5, // Max 5 connexions partagées (au lieu de 20)
    min: 0, // Min 0 (serverless = pas de connexions idle)
    idleTimeoutMillis: 30000, // Close idle après 30s (économie ressources)
    connectionTimeoutMillis: 5000, // Timeout 5s pour connexion

    // Retry automatique intégré au pool
    // Pas besoin de retry logic manuel !

    ssl: process.env.DB_CA
      ? {
          require: true,
          rejectUnauthorized: true,
          ca: process.env.DB_CA,
        }
      : false,
  };
}

/**
 * Get or create PostgreSQL connection pool
 * @returns {Pool} PostgreSQL pool singleton
 */
export function getPool() {
  if (!pool) {
    pool = new Pool(getPoolConfig());

    // Error handler global
    pool.on('error', (err) => {
      console.error(`[${getTimestamp()}] ❌ Pool Error:`, err.message);
      // Ne pas exit process, juste log
    });

    // Connect event (debug)
    pool.on('connect', () => {
      console.log(`[${getTimestamp()}] ✅ New client connected to pool`);
    });

    // Remove event (debug)
    pool.on('remove', () => {
      console.log(`[${getTimestamp()}] ℹ️ Client removed from pool`);
    });

    console.log(`[${getTimestamp()}] ✅ PostgreSQL Pool initialized`);
  }

  return pool;
}

/**
 * Execute a query using the connection pool
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params = []) {
  const start = Date.now();

  try {
    const pool = getPool();
    const result = await pool.query(text, params);

    const duration = Date.now() - start;
    console.log(`[${getTimestamp()}] ✅ Query executed in ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(
      `[${getTimestamp()}] ❌ Query error after ${duration}ms:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Get a client from pool for transactions
 * Use this ONLY for transactions, otherwise use query()
 * @returns {Promise<Object>} Client with release method
 */
export async function getClient() {
  const pool = getPool();
  const client = await pool.connect();

  console.log(`[${getTimestamp()}] ✅ Client acquired from pool`);

  // Add cleanup wrapper
  const release = client.release.bind(client);
  client.cleanup = async () => {
    release();
    console.log(`[${getTimestamp()}] ✅ Client released to pool`);
  };

  return client;
}

/**
 * Test database connectivity
 * Call this explicitly when needed, not at startup
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const result = await query('SELECT 1 as connected');
    console.log(`[${getTimestamp()}] ✅ Database connection test successful`);
    return result.rows[0].connected === 1;
  } catch (error) {
    console.error(
      `[${getTimestamp()}] ❌ Database connection test failed:`,
      error.message,
    );
    return false;
  }
}

/**
 * Gracefully close all pool connections
 * Use this on process shutdown
 */
export async function closePool() {
  if (pool) {
    try {
      await pool.end();
      console.log(`[${getTimestamp()}] ✅ Pool closed gracefully`);
      pool = null;
    } catch (error) {
      console.error(
        `[${getTimestamp()}] ❌ Error closing pool:`,
        error.message,
      );
    }
  }
}

// ===== PROCESS HANDLERS =====

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(`[${getTimestamp()}] 🛑 Received SIGINT, closing pool...`);
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`[${getTimestamp()}] 🛑 Received SIGTERM, closing pool...`);
  await closePool();
  process.exit(0);
});

// Vercel specific: Cleanup before function timeout
// Note: En production Vercel, SIGTERM pas toujours appelé
// Pool se nettoie automatiquement après idleTimeout

// ===== EXPORTS =====

export default {
  query, // Recommended: Use this for simple queries
  getClient, // Use only for transactions
  getPool, // Advanced: Direct pool access
  testConnection, // Manual connection test
  closePool, // Manual cleanup
};

/* 
USAGE EXAMPLES:

// 1. Simple query (RECOMMENDED - 95% des cas)
import { query } from '@backend/dbConnect';

const { rows } = await query(
  'SELECT * FROM admin.users WHERE user_id = $1',
  [userId]
);

// 2. Transaction (quand vraiment nécessaire)
import { getClient } from '@backend/dbConnect';

const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.cleanup(); // Release back to pool
}

// 3. Test connection (diagnostic)
import { testConnection } from '@backend/dbConnect';

const isConnected = await testConnection();
if (!isConnected) {
  throw new Error('Database unavailable');
}
*/
