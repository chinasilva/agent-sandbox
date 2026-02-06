/**
 * Agent Sandbox API Server
 * Complete AI Agent with Skills System and User Management
 */

import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.env.CONFIG_PATH || path.join(__dirname, '..', '..', 'config', 'default.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Import user database and auth middleware
import {
  createUser,
  validatePassword,
  findUserById,
  regenerateApiKey,
  updateCredits,
  deductTaskCredits,
  getCredits,
  getUserTasks,
  getUserTaskCount,
  createTask,
  updateTask,
  getTaskById,
  getAllUsers,
  getUserStats,
  usernameExists,
  initDatabase,
} from '../src/db/user.js';

import {
  generateTokenPair,
  combinedAuthMiddleware,
  adminMiddleware,
  creditCheckMiddleware,
} from '../src/middleware/auth.js';

// In-memory task storage (for current session)
const taskStore = new Map();
const taskResults = new Map();

// Try to load Redis
let Redis = null;
let redis = null;
let redisAvailable = false;

try {
  Redis = (await import('ioredis')).default;
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    redis.on('connect', () => {
      redisAvailable = true;
      console.log('✅ Redis connected');
    });
    redis.on('error', (e) => {
      console.log('⚠️ Redis error:', e.message);
    });
  }
} catch (e) {
  console.log('⚠️ Redis not available, using memory storage');
}

// Skill registry
const skills = new Map();

/**
 * Register a skill
 */
function registerSkill(name, handler) {
  skills.set(name, handler);
  console.log(`✅ Skill registered: ${name}`);
}

// Load skills
async function loadSkills() {
  const skillFiles = [
    { name: 'web-search', file: '../src/skills/web-search/index.js' },
    { name: 'code-generator', file: '../src/skills/code-generator/index.js' },
    { name: 'report-generator', file: '../src/skills/report-generator/index.js' },
    { name: 'github-publisher', file: '../src/skills/github-publisher/index.js' },
  ];
  
  for (const skill of skillFiles) {
    try {
      const skillModule = await import(skill.file);
      if (skillModule.default || skillModule.handler) {
        registerSkill(skill.name, skillModule.default || skillModule.handler);
      }
    } catch (e) {
      console.log(`⚠️ Skill ${skill.name} failed to load:`, e.message);
    }
  }
}

// Load skills on startup
loadSkills();

/**
 * Execute a skill
 */
async function executeSkill(skillName, input) {
  const skill = skills.get(skillName);
  if (!skill) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  return await skill(input);
}

/**
 * Execute task with agent
 */
async function executeTask(taskData) {
  const { id: taskId, task, tools, userId } = taskData;
  const results = {
    taskId,
    steps: [],
    output: '',
    createdAt: new Date().toISOString(),
  };

  const startTime = Date.now();
  
  try {
    // Step 1: Analyze task
    updateTaskProgress(taskId, 10, 'analyzing', 'Analyzing task requirements');
    results.steps.push({
      step: 'analyzing',
      status: 'success',
      message: 'Task requirements analyzed',
      timestamp: new Date().toISOString()
    });

    // Step 2: Execute requested skills
    const toolProgress = 20;
    const progressPerTool = Math.floor((100 - toolProgress) / (tools.length || 1));
    
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const progress = toolProgress + (i + 1) * progressPerTool;
      
      updateTaskProgress(taskId, progress, tool, `Executing ${tool} skill`);
      
      try {
        const skillResult = await executeSkill(tool, {
          task,
          context: results.steps,
        });
        
        results.steps.push({
          step: tool,
          status: 'success',
          result: skillResult,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        results.steps.push({
          step: tool,
          status: 'error',
          message: e.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Step 3: Generate final output
    updateTaskProgress(taskId, 90, 'generating', 'Generating final output');
    
    // Compile results
    results.output = generateTaskOutput(task, results.steps);
    results.executedAt = new Date().toISOString();
    results.duration = Date.now() - startTime;
    
    // Step 4: Complete
    updateTaskProgress(taskId, 100, 'completed', 'Task completed successfully');
    results.status = 'completed';
    
  } catch (error) {
    results.status = 'failed';
    results.error = error.message;
    results.duration = Date.now() - startTime;
    updateTaskProgress(taskId, 0, 'error', error.message);
  }

  return results;
}

/**
 * Generate task output
 */
function generateTaskOutput(task, steps) {
  const output = {
    task,
    summary: {
      totalSteps: steps.length,
      successful: steps.filter(s => s.status === 'success').length,
      failed: steps.filter(s => s.status === 'error').length,
    },
    results: steps.filter(s => s.result).map(s => ({
      tool: s.step,
      result: s.result,
    })),
    completedAt: new Date().toISOString(),
  };

  // Format as markdown
  let markdown = `# Task Results\n\n`;
  markdown += `## Task\n${task}\n\n`;
  markdown += `## Summary\n`;
  markdown += `- Total Steps: ${output.summary.totalSteps}\n`;
  markdown += `- Successful: ${output.summary.successful}\n`;
  markdown += `- Failed: ${output.summary.failed}\n\n`;
  
  if (output.results.length > 0) {
    markdown += `## Results\n\n`;
    for (const result of output.results) {
      markdown += `### ${result.tool}\n`;
      markdown += `\`\`\`\n${JSON.stringify(result.result, null, 2)}\n\`\`\`\n\n`;
    }
  }

  return markdown;
}

/**
 * Update task progress
 */
function updateTaskProgress(taskId, progress, step, message) {
  const taskData = taskStore.get(taskId) || {};
  const update = {
    status: progress < 100 ? 'running' : 'completed',
    progress,
    step,
    message,
    updatedAt: new Date().toISOString(),
  };
  
  taskStore.set(taskId, { ...taskData, ...update });
  
  // Also store in results for polling
  taskResults.set(taskId, update);
}

// Parse JSON body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Route handler
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ==================== AUTH ROUTES ====================
    
    // POST /api/v1/auth/register - Register new user
    if (method === 'POST' && pathname === '/api/v1/auth/register') {
      const body = await parseBody(req);
      const { username, password } = body;

      if (!username || !password) {
        return sendJSON(res, 400, { error: 'Username and password required' });
      }

      if (username.length < 3) {
        return sendJSON(res, 400, { error: 'Username must be at least 3 characters' });
      }

      if (password.length < 6) {
        return sendJSON(res, 400, { error: 'Password must be at least 6 characters' });
      }

      if (await usernameExists(username)) {
        return sendJSON(res, 409, { error: 'Username already exists' });
      }

      const user = await createUser(username, password);
      const tokens = generateTokenPair(user);

      return sendJSON(res, 201, {
        message: 'User registered successfully',
        user: {
          id: user.id,
          username: user.username,
          credits: user.credits,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
        },
        ...tokens,
      });
    }

    // POST /api/v1/auth/login - Login user
    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      const body = await parseBody(req);
      const { username, password } = body;

      if (!username || !password) {
        return sendJSON(res, 400, { error: 'Username and password required' });
      }

      const user = await validatePassword(username, password);
      
      if (!user) {
        return sendJSON(res, 401, { error: 'Invalid username or password' });
      }

      const tokens = generateTokenPair(user);

      return sendJSON(res, 200, {
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          credits: user.credits,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
        },
        ...tokens,
      });
    }

    // POST /api/v1/auth/refresh - Refresh access token
    if (method === 'POST' && pathname === '/api/v1/auth/refresh') {
      const body = await parseBody(req);
      const { refreshToken } = body;

      if (!refreshToken) {
        return sendJSON(res, 400, { error: 'Refresh token required' });
      }

      const { verifyToken } = require('../src/middleware/auth.js');
      const decoded = verifyToken(refreshToken);

      if (!decoded || decoded.type !== 'refresh') {
        return sendJSON(res, 401, { error: 'Invalid refresh token' });
      }

      const user = await findUserById(decoded.userId);
      if (!user) {
        return sendJSON(res, 401, { error: 'User not found' });
      }

      const tokens = generateTokenPair(user);

      return sendJSON(res, 200, {
        message: 'Token refreshed',
        ...tokens,
      });
    }

    // ==================== USER ROUTES ====================

    // GET /api/v1/user/profile - Get current user profile
    if (method === 'GET' && pathname === '/api/v1/user/profile') {
      const authResult = await new Promise((resolve) => {
        combinedAuthMiddleware(req, res, (err) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });

      if (!authResult) {
        return sendJSON(res, 401, { error: 'Authentication required' });
      }

      const user = await findUserById(req.user.id);
      const stats = await getUserStats(req.user.id);
      const credits = await getCredits(req.user.id);

      return sendJSON(res, 200, {
        user: {
          id: user.id,
          username: user.username,
          apiKey: user.api_key,
          credits: credits,
          isAdmin: user.is_admin,
          createdAt: user.created_at,
        },
        stats,
      });
    }

    // PUT /api/v1/user/api-key - Regenerate API key
    if (method === 'PUT' && pathname === '/api/v1/user/api-key') {
      const authResult = await new Promise((resolve) => {
        combinedAuthMiddleware(req, res, (err) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });

      if (!authResult) {
        return sendJSON(res, 401, { error: 'Authentication required' });
      }

      const newApiKey = await regenerateApiKey(req.user.id);

      return sendJSON(res, 200, {
        message: 'API key regenerated',
        apiKey: newApiKey,
      });
    }

    // PUT /api/v1/user/credits - Update user credits (admin only)
    if (method === 'PUT' && pathname === '/api/v1/user/credits') {
      const authResult = await new Promise((resolve) => {
        combinedAuthMiddleware(req, res, (err) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });

      if (!authResult) {
        return sendJSON(res, 401, { error: 'Authentication required' });
      }

      if (!req.user.isAdmin) {
        return sendJSON(res, 403, { error: 'Admin access required' });
      }

      const body = await parseBody(req);
      const { userId, amount, description } = body;

      if (!userId || amount === undefined) {
        return sendJSON(res, 400, { error: 'User ID and amount required' });
      }

      const updatedUser = await updateCredits(userId, amount, description || 'Admin adjustment');

      return sendJSON(res, 200, {
        message: 'Credits updated',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          credits: updatedUser.credits,
        },
      });
    }

    // GET /api/v1/user/tasks - Get user's task history
    if (method === 'GET' && pathname === '/api/v1/user/tasks') {
      const authResult = await new Promise((resolve) => {
        combinedAuthMiddleware(req, res, (err) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });

      if (!authResult) {
        return sendJSON(res, 401, { error: 'Authentication required' });
      }

      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const offset = parseInt(url.searchParams.get('offset')) || 0;

      const tasks = await getUserTasks(req.user.id, limit, offset);
      const total = await getUserTaskCount(req.user.id);

      return sendJSON(res, 200, {
        tasks,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + tasks.length < total,
        },
      });
    }

    // GET /api/v1/admin/users - Get all users (admin only)
    if (method === 'GET' && pathname === '/api/v1/admin/users') {
      const authResult = await new Promise((resolve) => {
        combinedAuthMiddleware(req, res, (err) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });

      if (!authResult) {
        return sendJSON(res, 401, { error: 'Authentication required' });
      }

      if (!req.user.isAdmin) {
        return sendJSON(res, 403, { error: 'Admin access required' });
      }

      const users = await getAllUsers();

      return sendJSON(res, 200, {
        users,
        count: users.length,
      });
    }

    // ==================== TASK ROUTES ====================

    // POST /api/v1/tasks - Submit task (requires auth + credits)
    if (method === 'POST' && pathname === '/api/v1/tasks') {
      const authResult = await new Promise((resolve) => {
        combinedAuthMiddleware(req, res, (err) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });

      if (!authResult) {
        return sendJSON(res, 401, { error: 'Authentication required' });
      }

      // Check credits
      const currentCredits = getCredits(req.user.id);
      if (currentCredits <= 0) {
        return sendJSON(res, 402, {
          error: 'Insufficient credits',
          code: 'NO_CREDITS',
          currentCredits: currentCredits,
        });
      }

      const body = await parseBody(req);
      const { task, tools = [] } = body;

      if (!task) {
        return sendJSON(res, 400, { error: 'Task description required' });
      }

      // Create task in database
      const dbTask = createTask(req.user.id, task, tools);
      
      const taskId = dbTask.id;
      const taskData = {
        ...dbTask,
        userId: req.user.id,
      };

      taskStore.set(taskId, taskData);
      
      // Deduct credits
      await deductTaskCredits(req.user.id);
      
      // Execute task asynchronously
      executeTask(taskData).then(result => {
        updateTask(taskId, {
          status: result.status,
          result: result.output,
          progress: 100,
        });
        
        taskResults.set(taskId, {
          status: result.status,
          progress: 100,
          step: result.status,
          result: result.output,
          completedAt: result.completedAt,
          duration: result.duration,
        });
      }).catch(error => {
        updateTask(taskId, {
          status: 'failed',
          error: error.message,
        });
        taskResults.set(taskId, {
          status: 'failed',
          progress: 0,
          step: 'error',
          error: error.message,
        });
      });

      return sendJSON(res, 200, {
        taskId,
        status: 'pending',
        message: 'Task submitted successfully',
        pollUrl: `/api/v1/tasks/${taskId}/poll`,
        skills: Array.from(skills.keys()),
        remainingCredits: currentCredits - 1,
      });
    }

    // ==================== EXISTING ROUTES ====================

    // GET /health
    if (method === 'GET' && pathname === '/health') {
      return sendJSON(res, 200, {
        status: 'healthy',
        mode: redisAvailable ? 'redis' : 'memory',
        skills: skills.size,
        skillsList: Array.from(skills.keys()),
        timestamp: new Date().toISOString(),
      });
    }

    // GET /api/v1/skills
    if (method === 'GET' && pathname === '/api/v1/skills') {
      return sendJSON(res, 200, {
        skills: Array.from(skills.keys()),
        count: skills.size,
      });
    }

    // GET /api/v1/tasks/:taskId/poll - Poll task status
    const taskMatch = pathname.match(/^\/api\/v1\/tasks\/([^/]+)\/poll$/);
    if (method === 'GET' && taskMatch) {
      const taskId = taskMatch[1];
      const result = taskResults.get(taskId);
      const taskData = taskStore.get(taskId);

      if (!taskData) {
        return sendJSON(res, 404, { error: 'Task not found' });
      }

      return sendJSON(res, 200, {
        taskId,
        status: result?.status || taskData.status,
        progress: result?.progress || taskData.progress || 0,
        step: result?.step || taskData.step,
        message: result?.message || taskData.message,
        createdAt: taskData.createdAt,
        completedAt: result?.completedAt || taskData.completedAt,
        duration: result?.duration,
        result: result?.result,
      });
    }

    // GET /api/v1/tasks/:taskId - Get full task details
    const detailMatch = pathname.match(/^\/api\/v1\/tasks\/([^/]+)$/);
    if (method === 'GET' && detailMatch && !pathname.includes('/poll')) {
      const taskId = detailMatch[1];
      const taskData = taskStore.get(taskId);
      const result = taskResults.get(taskId);

      if (!taskData) {
        // Try to get from database
        const dbTask = getTaskById(taskId);
        if (!dbTask) {
          return sendJSON(res, 404, { error: 'Task not found' });
        }
        return sendJSON(res, 200, {
          task: dbTask,
          result: result,
        });
      }

      return sendJSON(res, 200, {
        task: taskData,
        result: result,
      });
    }

    // POST /api/v1/tasks/:taskId/execute - Execute skill manually
    const execMatch = pathname.match(/^\/api\/v1\/tasks\/([^/]+)\/execute$/);
    if (method === 'POST' && execMatch) {
      const taskId = execMatch[1];
      const body = await parseBody(req);
      const { skill, input } = body;

      const taskData = taskStore.get(taskId);
      if (!taskData) {
        return sendJSON(res, 404, { error: 'Task not found' });
      }

      try {
        const skillResult = await executeSkill(skill, input || { task: taskData.task });
        return sendJSON(res, 200, {
          skill,
          result: skillResult,
        });
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
    }

    // GET /metrics
    if (method === 'GET' && pathname === '/metrics') {
      const completed = Array.from(taskResults.values()).filter(r => r.status === 'completed').length;
      const failed = Array.from(taskResults.values()).filter(r => r.status === 'failed').length;
      
      return sendJSON(res, 200, {
        agent_mode: redisAvailable ? 'redis' : 'memory',
        agent_skills_total: skills.size,
        agent_tasks_total: taskStore.size,
        agent_tasks_completed: completed,
        agent_tasks_failed: failed,
        agent_timestamp: Date.now(),
      });
    }

    // ==================== FRONTEND ====================

    // Serve static frontend
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const frontendPath = path.join(__dirname, '..', 'www', 'index.html');
      if (fs.existsSync(frontendPath)) {
        const content = fs.readFileSync(frontendPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }
    }

    // 404
    res.writeHead(404);
    res.end('Not Found');

  } catch (error) {
    console.error('Error:', error);
    sendJSON(res, 500, { error: error.message });
  }
}

// Start server
const PORT = config.server.port || 3000;
const HOST = config.server.host || '0.0.0.0';

// Async startup
async function startServer() {
  try {
    console.log('📦 Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized');
    
    const server = http.createServer(handleRequest);
    
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Agent Sandbox running on http://${HOST}:${PORT}`);
      console.log(`📋 Health: http://${HOST}:${PORT}/health`);
      console.log(`✅ Skills loaded: ${skills.size}`);
      console.log(`🎯 Mode: ${redisAvailable ? 'Redis' : 'Memory'}`);
      console.log(`👥 User system: enabled (SQLite)`);
    });
    
    process.on('SIGTERM', () => {
      console.log('Shutting down...');
      server.close(() => process.exit(0));
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
