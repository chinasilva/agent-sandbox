/**
 * Agent Sandbox API - Local Development Server
 * This version runs locally with http module
 */

import http from 'http';
import { URL } from 'url';

const PORT = process.env.PORT || 3000;

// In-memory storage (demo mode)
const users = new Map();
const tasks = new Map();
let userIdCounter = 1;
let taskIdCounter = 1;

// Generate tokens
function generateToken() {
  return Buffer.from(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).toString('base64');
}

// Parse body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Main handler
async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;
  const body = await parseBody(req);

  try {
    // Health check
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        mode: 'demo-local',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // API info
    if (pathname === '/' || pathname === '/api') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'Agent Sandbox API',
        version: '1.0.0',
        mode: 'demo-local',
        message: 'Demo mode - all data stored in memory',
        endpoints: [
          'GET /health',
          'POST /api/v1/auth/register',
          'POST /api/v1/auth/login',
          'GET /api/v1/user/profile',
          'POST /api/v1/tasks',
          'GET /api/v1/skills',
        ],
      }));
      return;
    }

    // Register
    if (pathname === '/api/v1/auth/register' && method === 'POST') {
      const { username, password } = body;
      
      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username and password required' }));
        return;
      }
      if (username.length < 3) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username must be at least 3 characters' }));
        return;
      }
      if (password.length < 6) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Password must be at least 6 characters' }));
        return;
      }

      if (users.has(username)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username already exists' }));
        return;
      }

      const userId = String(userIdCounter++);
      const user = {
        id: userId,
        username,
        credits: 100,
        isAdmin: false,
      };
      users.set(username, { ...user, password });
      users.set(userId, user);

      const accessToken = generateToken();
      const refreshToken = generateToken();

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'User registered successfully',
        user,
        apiKey: `ask_${generateToken().substr(0, 24)}`,
        accessToken,
        refreshToken,
        expiresIn: '24h',
      }));
      return;
    }

    // Login
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const { username, password } = body;
      
      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username and password required' }));
        return;
      }

      const userData = users.get(username);
      if (!userData || userData.password !== password) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid username or password' }));
        return;
      }

      const { password: _, ...user } = userData;
      const accessToken = generateToken();
      const refreshToken = generateToken();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Login successful',
        user,
        accessToken,
        refreshToken,
        expiresIn: '24h',
      }));
      return;
    }

    // Get profile
    if (pathname === '/api/v1/user/profile' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }

      // 简化验证：直接查找用户
      // token 可能存储在 users Map 中
      const token = authHeader.replace('Bearer ', '');
      
      // 先尝试用 token 作为 key 查找
      let userData = users.get(token);
      
      // 如果没有，尝试解码 token
      if (!userData) {
        try {
          const decoded = Buffer.from(token, 'base64').toString();
          const userId = decoded.split(':')[0];
          userData = users.get(userId);
        } catch (e) {
          userData = null;
        }
      }
      
      if (!userData) {
        // 最后尝试：遍历查找（因为 Map 是按插入顺序的）
        for (const [key, value] of users.entries()) {
          if (typeof key === 'string' && value.username) {
            userData = value;
            break;
          }
        }
      }
      
      if (!userData || !userData.id) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }

      const { password: _, ...user } = userData;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        user,
        stats: { total_tasks: 0, completed_tasks: 0, failed_tasks: 0 },
      }));
      return;
    }

    // Submit task
    if (pathname === '/api/v1/tasks' && method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }

      const { task, tools } = body;
      if (!task) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task description required' }));
        return;
      }

      const taskId = String(taskIdCounter++);
      tasks.set(taskId, {
        id: taskId,
        task,
        tools: tools || [],
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        taskId,
        status: 'pending',
        message: 'Task submitted successfully',
        pollUrl: `/api/v1/tasks/${taskId}/poll`,
        remainingCredits: 99,
      }));
      return;
    }

    // Get tasks
    if (pathname === '/api/v1/user/tasks' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tasks: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      }));
      return;
    }

    // Poll task
    if (pathname.match(/^\/api\/v1\/tasks\/[^/]+\/poll$/) && method === 'GET') {
      const taskId = pathname.split('/')[4];
      const task = tasks.get(taskId);
      
      if (!task) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        message: task.message || 'Task queued',
      }));
      return;
    }

    // Skills
    if (pathname === '/api/v1/skills' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        skills: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
        count: 4,
      }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
}

// Start server
const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`🚀 Agent Sandbox API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/`);
  console.log(`   Skills: http://localhost:${PORT}/api/v1/skills`);
});

export default handler;
