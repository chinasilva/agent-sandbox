/**
 * Vercel Serverless API - Fast Deploy Version
 * Uses @vercel/postgres for database (fast, integrated)
 */

import { sql } from '@vercel/postgres';
import { Pool } from 'pg';

// Check if we should use @vercel/postgres (fast) or pg (flexible)
const USE_VERCEL_POSTGRES = process.env.VERCEL === '1' && process.env.POSTGRES_URL;

// Create connection pool for standard PostgreSQL (Supabase)
let pool = null;
const SUPABASE_URL = process.env.SANDBOX_POSTGRES_URL || process.env.sandbox_POSTGRES_URL;
const SUPABASE_HOST = process.env.SANDBOX_POSTGRES_HOST || process.env.sandbox_POSTGRES_HOST;
const SUPABASE_USER = process.env.SANDBOX_POSTGRES_USER || process.env.sandbox_POSTGRES_USER;
const SUPABASE_PASSWORD = process.env.SANDBOX_POSTGRES_PASSWORD || process.env.sandbox_POSTGRES_PASSWORD;
const SUPABASE_DATABASE = process.env.SANDBOX_POSTGRES_DATABASE || process.env.sandbox_POSTGRES_DATABASE;

if (!USE_VERCEL_POSTGRES && SUPABASE_URL) {
  pool = new Pool({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000, // 15秒超时
    max: 1,
  });
}

// Initialize database tables (lazy)
let initialized = false;

/**
 * Initialize database tables
 */
async function initDatabase() {
  if (initialized) return true;
  
  console.log('🔄 Initializing database...');
  console.log('  Vercel:', process.env.VERCEL);
  console.log('  Supabase URL:', SUPABASE_URL ? 'configured' : 'not configured');
  console.log('  Vercel Postgres:', USE_VERCEL_POSTGRES ? 'enabled' : 'disabled');
  
  try {
    if (USE_VERCEL_POSTGRES) {
      // Use @vercel/postgres
      console.log('  Using: @vercel/postgres');
      await sql`SELECT 1`;
    } else if (pool && SUPABASE_URL) {
      // Use Supabase
      console.log('  Using: Supabase');
      const result = await pool.query('SELECT NOW()');
      console.log('  Connected:', result.rows[0]?.now || 'success');
    } else {
      console.log('  No database configured, running in demo mode');
      return false;
    }
    
    initialized = true;
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('  Code:', error.code);
    console.error('  Detail:', error.detail || 'N/A');
    // Don't block deployment
    initialized = true;
    return false;
  }
}

/**
 * Execute query with fallback
 */
async function query(text, params = []) {
  if (USE_VERCEL_POSTGRES) {
    return sql`${text}`, params;
  } else if (pool) {
    return pool.query(text, params);
  } else {
    throw new Error('No database configured');
  }
}

/**
 * Generate a new API key
 */
function generateApiKey() {
  return `ask_${crypto.randomUUID().replace(/-/g, '')}`;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const url = new URL(req.url || '/', `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  const body = req.body || {};

  try {
    // Health check
    if (pathname === '/health' && method === 'GET') {
      let dbStatus = 'not configured';
      let dbLatency = null;
      
      try {
        if (USE_VERCEL_POSTGRES) {
          const start = Date.now();
          await sql`SELECT 1`;
          dbLatency = Date.now() - start;
          dbStatus = 'vercel-postgres';
        } else if (pool && SUPABASE_URL) {
          const start = Date.now();
          await pool.query('SELECT 1');
          dbLatency = Date.now() - start;
          dbStatus = 'supabase';
        }
      } catch (e) {
        dbStatus = 'error: ' + e.message;
      }
      
      return res.json({
        status: 'healthy',
        mode: USE_VERCEL_POSTGRES ? 'vercel-postgres' : (pool ? 'supabase' : 'demo'),
        database: dbStatus,
        latency_ms: dbLatency,
        timestamp: new Date().toISOString(),
      });
    }

    // List skills
    if (pathname === '/api/v1/skills' && method === 'GET') {
      return res.json({
        skills: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
        count: 4,
      });
    }

    // Register user
    if (pathname === '/api/v1/auth/register' && method === 'POST') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      try {
        await initDatabase();
        
        // Check if username exists
        const bcrypt = await import('bcryptjs');
        const crypto = await import('crypto');
        const id = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);
        const apiKey = generateApiKey();
        
        let result;
        if (USE_VERCEL_POSTGRES) {
          result = await sql`
            INSERT INTO users (id, username, password_hash, api_key, credits, is_admin)
            VALUES (${id}, ${username}, ${passwordHash}, ${apiKey}, 100, 0)
            RETURNING id, username, credits, is_admin, created_at
          `;
        } else if (pool) {
          result = await pool.query(`
            INSERT INTO users (id, username, password_hash, api_key, credits, is_admin)
            VALUES ($1, $2, $3, $4, 100, 0)
            RETURNING id, username, credits, is_admin, created_at
          `, [id, username, passwordHash, apiKey]);
        }

        const user = result.rows[0];
        const accessToken = Buffer.from(`${id}:${Date.now()}`).toString('base64');
        const refreshToken = crypto.randomUUID();

        return res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: user.id,
            username: user.username,
            credits: 100,
            isAdmin: false,
            createdAt: user.created_at,
          },
          apiKey,
          accessToken,
          refreshToken,
          expiresIn: '24h',
        });
      } catch (error) {
        if (error.message?.includes('duplicate key') || error.code === '23505') {
          return res.status(409).json({ error: 'Username already exists' });
        }
        throw error;
      }
    }

    // Login user
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      try {
        await initDatabase();
        
        let result;
        if (USE_VERCEL_POSTGRES) {
          result = await sql`SELECT * FROM users WHERE username = ${username}`;
        } else if (pool) {
          result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
        }
        
        const user = result.rows[0];
        
        if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        const bcrypt = await import('bcryptjs');
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (!valid) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        const crypto = await import('crypto');
        const accessToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
        const refreshToken = crypto.randomUUID();

        return res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            username: user.username,
            credits: user.credits,
            isAdmin: user.is_admin === 1 || user.is_admin === true,
            createdAt: user.created_at,
          },
          accessToken,
          refreshToken,
          expiresIn: '24h',
        });
      } catch (error) {
        throw error;
      }
    }

    // Get user profile
    if (pathname === '/api/v1/user/profile' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const token = authHeader.replace('Bearer ', '');
        const [userId] = Buffer.from(token, 'base64').toString().split(':');
        
        await initDatabase();
        
        let result;
        if (USE_VERCEL_POSTGRES) {
          result = await sql`
            SELECT id, username, api_key, credits, is_admin, created_at 
            FROM users WHERE id = ${userId}
          `;
        } else if (pool) {
          result = await pool.query(`
            SELECT id, username, api_key, credits, is_admin, created_at 
            FROM users WHERE id = $1
          `, [userId]);
        }

        if (!result.rows[0]) {
          return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        return res.json({
          user: {
            id: user.id,
            username: user.username,
            apiKey: user.api_key,
            credits: user.credits,
            isAdmin: user.is_admin === 1 || user.is_admin === true,
            createdAt: user.created_at,
          },
          stats: { total_tasks: 0, completed_tasks: 0, failed_tasks: 0 },
        });
      } catch (error) {
        throw error;
      }
    }

    // Submit task
    if (pathname === '/api/v1/tasks' && method === 'POST') {
      return res.status(503).json({ 
        error: 'Task execution not available in demo mode',
        message: 'Please configure a database to enable task execution'
      });
    }

    // Get task history
    if (pathname === '/api/v1/user/tasks' && method === 'GET') {
      return res.json({ tasks: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } });
    }

    // Poll task
    if (pathname.match(/^\/api\/v1\/tasks\/[^/]+\/poll$/) && method === 'GET') {
      return res.status(404).json({ error: 'Task not found' });
    }

    // API info
    if (pathname === '/' || pathname === '/api') {
      return res.json({
        name: 'Agent Sandbox API',
        version: '1.0.0',
        mode: USE_VERCEL_POSTGRES ? 'vercel-postgres' : (pool ? 'postgres' : 'demo'),
        database: pool || USE_VERCEL_POSTGRES ? 'connected' : 'demo-mode',
        endpoints: {
          'POST /api/v1/auth/register': 'Register user',
          'POST /api/v1/auth/login': 'Login',
          'GET /api/v1/user/profile': 'Get profile (auth required)',
          'POST /api/v1/tasks': 'Submit task (requires database)',
        },
        setup: !pool && !USE_VERCEL_POSTGRES ? 'Configure DATABASE_URL or create Vercel Postgres database' : null,
      });
    }

    res.status(404).json({ error: 'Not Found' });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
