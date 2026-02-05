/**
 * Agent Sandbox API Server
 * Complete AI Agent with Skills System
 */

import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.env.CONFIG_PATH || path.join(__dirname, '..', '..', 'config', 'default.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// In-memory task storage
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
    { name: 'web-search', file: '../skills/web-search/index.js' },
    { name: 'code-generator', file: '../skills/code-generator/index.js' },
    { name: 'report-generator', file: '../skills/report-generator/index.js' },
    { name: 'github-publisher', file: '../skills/github-publisher/index.js' },
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
  const { id: taskId, task, tools } = taskData;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
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

    // POST /api/v1/tasks - Submit task
    if (method === 'POST' && pathname === '/api/v1/tasks') {
      const body = await parseBody(req);
      const { task, tools = [], apiKey } = body;

      if (!apiKey) {
        return sendJSON(res, 401, { error: 'API key required' });
      }

      const taskId = uuidv4();
      const taskData = {
        id: taskId,
        task,
        tools,
        status: 'pending',
        progress: 0,
        step: 'queued',
        message: 'Task queued',
        createdAt: new Date().toISOString(),
        result: null,
      };

      taskStore.set(taskId, taskData);
      
      // Execute task asynchronously
      executeTask(taskData).then(result => {
        taskResults.set(taskId, {
          status: result.status,
          progress: 100,
          step: result.status,
          result: result.output,
          completedAt: result.completedAt,
          duration: result.duration,
        });
        taskStore.set(taskId, {
          ...taskData,
          ...result,
          status: result.status,
        });
      }).catch(error => {
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
        return sendJSON(res, 404, { error: 'Task not found' });
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

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`🚀 Agent Sandbox running on http://${HOST}:${PORT}`);
  console.log(`📋 Health: http://${HOST}:${PORT}/health`);
  console.log(`✅ Skills loaded: ${skills.size}`);
  console.log(`🎯 Mode: ${redisAvailable ? 'Redis' : 'Memory'}`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});
