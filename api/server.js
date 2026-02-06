/**
 * Vercel Serverless Entry Point - SQLite Version
 * No external database connection required!
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'app.sqlite');

// In-memory SQLite database
let db = null;
let dbReady = false;

/**
 * Initialize SQLite database
 */
async function initDb() {
  if (dbReady) return;
  
  try {
    const SQL = await initSqlJs();
    
    // Try to load existing database
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      console.log('✅ Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('✅ Created new database');
    }
    
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        credits INTEGER DEFAULT 100,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task TEXT NOT NULL,
        tools TEXT,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        step TEXT,
        message TEXT,
        result TEXT,
        credits_used INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Save to file
    saveDb();
    
    dbReady = true;
    console.log('✅ SQLite database initialized');
  } catch (error) {
    console.error('❌ Database init failed:', error.message);
  }
}

/**
 * Save database to file
 */
function saveDb() {
  if (!db) return;
  
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    
    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('Failed to save database:', error.message);
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
      return res.json({
        status: 'healthy',
        mode: 'sqlite',
        database: dbReady ? 'ready' : 'initializing',
        timestamp: new Date().toISOString(),
      });
    }

    // API info
    if (pathname === '/' || pathname === '/api') {
      return res.json({
        name: 'Agent Sandbox API',
        version: '1.0.0',
        mode: 'sqlite',
        database: dbReady ? 'ready' : 'initializing',
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

      // Check if username exists
      const existing = db.exec(`SELECT id FROM users WHERE username = ?`, [username]);
      if (existing.length > 0 && existing[0].values.length > 0) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // Insert user
      db.run(
        `INSERT INTO users (id, username, password_hash, api_key, credits, is_admin) VALUES (?, ?, ?, ?, 100, 0)`,
        [id, username, passwordHash, apiKey]
      );
      saveDb();

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

      const result = db.exec(`SELECT * FROM users WHERE username = ?`, [username]);
      if (result.length === 0 || result[0].values.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const columns = result[0].columns;
      const values = result[0].values[0];
      const user = {};
      columns.forEach((col, i) => user[col] = values[i]);

      const valid = await comparePassword(password, user.password_hash);
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

      const result = db.exec(`SELECT id, username, api_key, credits, is_admin, created_at FROM users WHERE id = ?`, [userId]);
      if (result.length === 0 || result[0].values.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const columns = result[0].columns;
      const values = result[0].values[0];
      const user = {};
      columns.forEach((col, i) => user[col] = values[i]);

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
      const createdAt = new Date().toISOString();

      db.run(
        `INSERT INTO tasks (id, user_id, task, tools, status, progress, message) VALUES (?, ?, ?, ?, 'pending', 0, 'Task queued')`,
        [taskId, userId, task, JSON.stringify(tools || [])]
      );
      saveDb();

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
      const result = db.exec(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
      
      if (result.length === 0 || result[0].values.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const columns = result[0].columns;
      const values = result[0].values[0];
      const task = {};
      columns.forEach((col, i) => task[col] = values[i]);

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
