/**
 * Vercel Serverless Entry Point
 * Handles API requests for Vercel deployment
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration
const SUPABASE_URL = process.env.SANDBOX_POSTGRES_URL || process.env.sandbox_POSTGRES_URL;
const pool = SUPABASE_URL ? new Pool({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  max: 1,
}) : null;

let dbInitialized = false;

// Simple in-memory store for demo mode
const users = new Map();
const tasks = new Map();

/**
 * Initialize database
 */
async function initDb() {
  if (dbInitialized || !pool) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        credits INTEGER DEFAULT 100,
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    dbInitialized = true;
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database init failed:', error.message);
  }
}

/**
 * Generate API key
 */
function generateApiKey() {
  return `ask_${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Hash password
 */
async function hashPassword(password) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}

/**
 * Compare password
 */
async function comparePassword(password, hash) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Parse URL
  const url = new URL(req.url || '/', `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  const body = req.body || {};

  // Initialize database on first request
  await initDb();

  try {
    // Health check
    if (pathname === '/health') {
      let dbStatus = 'not configured';
      if (pool) {
        try {
          await pool.query('SELECT 1');
          dbStatus = 'connected';
        } catch (e) {
          dbStatus = 'error: ' + e.message;
        }
      }
      return res.json({
        status: 'healthy',
        mode: pool ? 'supabase' : 'demo',
        database: dbStatus,
        timestamp: new Date().toISOString(),
      });
    }

    // API info
    if (pathname === '/' || pathname === '/api') {
      return res.json({
        name: 'Agent Sandbox API',
        version: '1.0.0',
        mode: pool ? 'supabase' : 'demo',
        database: pool ? 'connected' : 'demo-mode',
        endpoints: [
          'GET /health',
          'POST /api/v1/auth/register',
          'POST /api/v1/auth/login',
          'GET /api/v1/user/profile',
          'POST /api/v1/tasks',
          'GET /api/v1/user/tasks',
        ],
      });
    }

    // Register
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

      const crypto = await import('crypto');
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      const apiKey = generateApiKey();
      const accessToken = Buffer.from(`${id}:${Date.now()}`).toString('base64');
      const refreshToken = crypto.randomUUID();

      if (pool) {
        try {
          await pool.query(`
            INSERT INTO users (id, username, password_hash, api_key, credits, is_admin)
            VALUES ($1, $2, $3, $4, 100, 0)
          `, [id, username, passwordHash, apiKey]);
        } catch (error) {
          if (error.code === '23505') {
            return res.status(409).json({ error: 'Username already exists' });
          }
          throw error;
        }
      } else {
        // Demo mode - store in memory
        if (users.has(username)) {
          return res.status(409).json({ error: 'Username already exists' });
        }
        users.set(username, { id, passwordHash, apiKey, credits: 100 });
      }

      return res.status(201).json({
        message: 'User registered successfully',
        user: { id, username, credits: 100, isAdmin: false },
        apiKey,
        accessToken,
        refreshToken,
        expiresIn: '24h',
      });
    }

    // Login
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      let user = null;

      if (pool) {
        const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
        user = result.rows[0];
      } else {
        user = users.get(username);
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const valid = pool 
        ? await comparePassword(password, user.password_hash)
        : await comparePassword(password, user.passwordHash);

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
          username: pool ? user.username : username,
          credits: user.credits,
          isAdmin: user.is_admin === 1,
        },
        accessToken,
        refreshToken,
        expiresIn: '24h',
      });
    }

    // Get profile
    if (pathname === '/api/v1/user/profile' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.replace('Bearer ', '');
      const [userId] = Buffer.from(token, 'base64').toString().split(':');

      let user = null;
      if (pool) {
        const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        user = result.rows[0];
      }

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          credits: user.credits,
          isAdmin: user.is_admin === 1,
        },
        stats: { total_tasks: 0, completed_tasks: 0, failed_tasks: 0 },
      });
    }

    // Submit task
    if (pathname === '/api/v1/tasks' && method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.replace('Bearer ', '');
      const [userId] = Buffer.from(token, 'base64').toString().split(':');
      const { task, tools } = body;

      if (!task) {
        return res.status(400).json({ error: 'Task description required' });
      }

      const crypto = await import('crypto');
      const taskId = crypto.randomUUID();

      tasks.set(taskId, {
        id: taskId,
        userId,
        task,
        tools: tools || [],
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
      });

      return res.json({
        taskId,
        status: 'pending',
        message: 'Task submitted successfully',
        pollUrl: `/api/v1/tasks/${taskId}/poll`,
        remainingCredits: 99,
      });
    }

    // Get tasks
    if (pathname === '/api/v1/user/tasks' && method === 'GET') {
      return res.json({
        tasks: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      });
    }

    // Poll task
    if (pathname.match(/^\/api\/v1\/tasks\/[^/]+\/poll$/) && method === 'GET') {
      const taskId = pathname.split('/')[4];
      const task = tasks.get(taskId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json({
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        message: task.message || 'Task queued',
      });
    }

    // Skills
    if (pathname === '/api/v1/skills' && method === 'GET') {
      return res.json({
        skills: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
        count: 4,
      });
    }

    // 404
    return res.status(404).json({ error: 'Not Found', path: pathname });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
