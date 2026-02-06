/**
 * Vercel Serverless API - Full Version with Database Support
 * Uses @vercel/postgres for user management
 */

import { sql } from '@vercel/postgres';

// Initialize database on cold start
let dbInitialized = false;
async function ensureDbInit() {
  if (dbInitialized) return;
  try {
    // Create tables if not exist
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        credits INTEGER DEFAULT 100,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    dbInitialized = true;
  } catch (e) {
    console.error('DB init error:', e.message);
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const url = new URL(req.url || '/', `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Health check
    if (pathname === '/health' && method === 'GET') {
      return res.json({
        status: 'healthy',
        mode: 'vercel-postgres',
        skills: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
        skillsList: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
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
      await ensureDbInit();
      const { username, password } = req.body || {};
      
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
        // Check if username exists
        const existing = await sql`SELECT 1 FROM users WHERE username = ${username}`;
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'Username already exists' });
        }

        // Create user
        const bcrypt = await import('bcryptjs');
        const crypto = await import('crypto');
        const id = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);
        const apiKey = `ask_${crypto.randomUUID().replace(/-/g, '')}`;

        await sql`
          INSERT INTO users (id, username, password_hash, api_key, credits, is_admin)
          VALUES (${id}, ${username}, ${passwordHash}, ${apiKey}, 100, 0)
        `;

        return res.status(201).json({
          message: 'User registered successfully',
          user: {
            id,
            username,
            credits: 100,
            isAdmin: false,
            createdAt: new Date().toISOString(),
          },
          apiKey,
        });
      } catch (error) {
        if (error.message?.includes('duplicate key')) {
          return res.status(409).json({ error: 'Username already exists' });
        }
        throw error;
      }
    }

    // Login user
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      await ensureDbInit();
      const { username, password } = req.body || {};
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      try {
        const result = await sql`SELECT * FROM users WHERE username = ${username}`;
        const user = result.rows[0];
        
        if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        const bcrypt = await import('bcryptjs');
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (!valid) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate simple token (for demo purposes)
        const crypto = await import('crypto');
        const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

        return res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            username: user.username,
            credits: user.credits,
            isAdmin: user.is_admin === 1,
            createdAt: user.created_at,
          },
          accessToken: token,
          expiresIn: '24h',
        });
      } catch (error) {
        throw error;
      }
    }

    // Get user profile
    if (pathname === '/api/v1/user/profile' && method === 'GET') {
      await ensureDbInit();
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const token = authHeader.replace('Bearer ', '');
        const [userId] = Buffer.from(token, 'base64').toString().split(':');
        
        const result = await sql`
          SELECT id, username, api_key, credits, is_admin, created_at FROM users WHERE id = ${userId}
        `;
        
        if (!result.rows[0]) {
          return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Get stats
        const statsResult = await sql`
          SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks
          FROM tasks WHERE user_id = ${userId}
        `;
        const stats = statsResult.rows[0];

        return res.json({
          user: {
            id: user.id,
            username: user.username,
            apiKey: user.api_key,
            credits: user.credits,
            isAdmin: user.is_admin === 1,
            createdAt: user.created_at,
          },
          stats: {
            total_tasks: parseInt(stats.total_tasks) || 0,
            completed_tasks: parseInt(stats.completed_tasks) || 0,
            failed_tasks: parseInt(stats.failed_tasks) || 0,
          },
        });
      } catch (error) {
        throw error;
      }
    }

    // Submit task
    if (pathname === '/api/v1/tasks' && method === 'POST') {
      await ensureDbInit();
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const token = authHeader.replace('Bearer ', '');
        const [userId] = Buffer.from(token, 'base64').toString().split(':');
        
        const { task, tools = [] } = req.body || {};
        
        if (!task) {
          return res.status(400).json({ error: 'Task description required' });
        }

        // Check credits
        const creditResult = await sql`SELECT credits FROM users WHERE id = ${userId}`;
        const credits = creditResult.rows[0]?.credits || 0;
        
        if (credits <= 0) {
          return res.status(402).json({ error: 'Insufficient credits', currentCredits: credits });
        }

        // Create task
        const crypto = await import('crypto');
        const taskId = crypto.randomUUID();
        
        await sql`
          INSERT INTO tasks (id, user_id, task, tools, status, progress, step, message, credits_used)
          VALUES (${taskId}, ${userId}, ${task}, ${JSON.stringify(tools)}, 'pending', 0, 'queued', 'Task queued', 1)
        `;

        // Deduct credits
        await sql`UPDATE users SET credits = credits - 1 WHERE id = ${userId}`;

        return res.json({
          taskId,
          status: 'pending',
          message: 'Task submitted successfully',
          pollUrl: `/api/v1/tasks/${taskId}/poll`,
          skills: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
          remainingCredits: credits - 1,
        });
      } catch (error) {
        throw error;
      }
    }

    // Get task history
    if (pathname === '/api/v1/user/tasks' && method === 'GET') {
      await ensureDbInit();
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const token = authHeader.replace('Bearer ', '');
        const [userId] = Buffer.from(token, 'base64').toString().split(':');
        
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        const result = await sql`
          SELECT * FROM tasks WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        const countResult = await sql`SELECT COUNT(*) as count FROM tasks WHERE user_id = ${userId}`;
        const total = parseInt(countResult.rows[0].count);

        return res.json({
          tasks: result.rows.map(t => ({
            ...t,
            tools: JSON.parse(t.tools || '[]'),
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + result.rows.length < total,
          },
        });
      } catch (error) {
        throw error;
      }
    }

    // Poll task status
    if (pathname.match(/^\/api\/v1\/tasks\/[^/]+\/poll$/) && method === 'GET') {
      await ensureDbInit();
      const taskId = pathname.split('/')[4];
      
      const result = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;
      const task = result.rows[0];
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json({
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        step: task.step,
        message: task.message,
        createdAt: task.created_at,
        result: task.result,
      });
    }

    // Metrics
    if (pathname === '/metrics' && method === 'GET') {
      return res.json({
        agent_mode: 'vercel-postgres',
        agent_skills_total: 4,
        agent_timestamp: Date.now(),
      });
    }

    // API info
    if (pathname === '/' || pathname === '/api') {
      return res.json({
        name: 'Agent Sandbox API',
        version: '1.0.0',
        mode: 'vercel-postgres',
        description: 'AI-powered task execution platform with user system',
        endpoints: {
          'GET /': 'API info',
          'GET /health': 'Health check',
          'GET /api/v1/skills': 'List skills',
          'POST /api/v1/auth/register': 'Register user',
          'POST /api/v1/auth/login': 'Login',
          'GET /api/v1/user/profile': 'Get user profile',
          'POST /api/v1/tasks': 'Submit task (requires auth)',
          'GET /api/v1/user/tasks': 'Get task history (requires auth)',
          'GET /api/v1/tasks/:id/poll': 'Poll task status',
          'GET /metrics': 'Prometheus metrics',
        },
        skills: {
          'web-search': 'Internet search',
          'code-generator': 'Code generation',
          'report-generator': 'Report generation',
          'github-publisher': 'GitHub integration',
        },
        features: {
          userSystem: true,
          creditsSystem: true,
          taskQueue: true,
        },
        github: 'https://github.com/chinasilva/agent-sandbox',
      });
    }

    // 404
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${method} ${pathname} not found`,
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

// Enable body parsing for POST requests
export const config = {
  api: {
    bodyParser: true,
  },
};
