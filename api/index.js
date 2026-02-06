/**
 * Agent Sandbox API - Minimal Demo Version
 * Zero external dependencies for fast deployment
 */

console.log('🚀 API function initialized');

export default async function handler(req, res) {
  console.log('📝 Request:', req.method, req.url);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url || '/', `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  const body = req.body || {};

  // In-memory storage (demo mode)
  const users = new Map();
  const tasks = new Map();
  let userIdCounter = 1;
  let taskIdCounter = 1;

  // Generate tokens
  function generateToken() {
    return Buffer.from(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).toString('base64');
  }

  try {
    console.log('✅ Request processing:', pathname);
    
    // Health check - instant!
    if (pathname === '/health') {
      return res.json({
        status: 'healthy',
        mode: 'demo',
        timestamp: new Date().toISOString(),
      });
    }

    // API info
    if (pathname === '/' || pathname === '/api') {
      return res.json({
        name: 'Agent Sandbox API',
        version: '1.0.0',
        mode: 'demo',
        message: 'Demo mode - all data stored in memory',
        endpoints: [
          'GET /health',
          'POST /api/v1/auth/register',
          'POST /api/v1/auth/login',
          'GET /api/v1/user/profile',
          'POST /api/v1/tasks',
          'GET /api/v1/skills',
        ],
      });
    }

    // Register - demo mode
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

      if (users.has(username)) {
        return res.status(409).json({ error: 'Username already exists' });
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

      return res.status(201).json({
        message: 'User registered successfully',
        user,
        apiKey: `ask_${generateToken().substr(0, 24)}`,
        accessToken,
        refreshToken,
        expiresIn: '24h',
      });
    }

    // Login - demo mode
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const userData = users.get(username);
      if (!userData || userData.password !== password) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const { password: _, ...user } = userData;
      const accessToken = generateToken();
      const refreshToken = generateToken();

      return res.json({
        message: 'Login successful',
        user,
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

      // Simple demo auth - accept any token
      const userId = authHeader.replace('Bearer ', '').substr(0, 10);
      const userData = users.get(userId);
      
      if (!userData) {
        return res.status(401).json({ error: 'User not found' });
      }

      const { password: _, ...user } = userData;
      return res.json({
        user,
        stats: { total_tasks: 0, completed_tasks: 0, failed_tasks: 0 },
      });
    }

    // Submit task
    if (pathname === '/api/v1/tasks' && method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { task, tools } = body;
      if (!task) {
        return res.status(400).json({ error: 'Task description required' });
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

      return res.json({
        taskId,
        status: 'pending',
        message: 'Task submitted successfully (demo mode)',
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
        message: task.message || 'Task queued (demo mode)',
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

export default handler;
