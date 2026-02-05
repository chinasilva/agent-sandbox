/**
 * Agent Sandbox API Server
 * Native Node.js HTTP server (no Hono dependency)
 */

import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config', 'default.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// In-memory storage for testing
const memoryStore = new Map();

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
  const path = url.pathname;
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
    if (method === 'GET' && path === '/health') {
      return sendJSON(res, 200, {
        status: 'healthy',
        mode: 'memory',
        timestamp: new Date().toISOString(),
      });
    }

    // POST /api/v1/tasks
    if (method === 'POST' && path === '/api/v1/tasks') {
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

      memoryStore.set(`task:${taskId}`, taskData);

      return sendJSON(res, 200, {
        taskId,
        status: 'pending',
        message: 'Task queued successfully',
        pollUrl: `/api/v1/tasks/${taskId}/poll`,
      });
    }

    // GET /api/v1/tasks/:taskId/poll
    const taskMatch = path.match(/^\/api\/v1\/tasks\/([^/]+)\/poll$/);
    if (method === 'GET' && taskMatch) {
      const taskId = taskMatch[1];
      const taskData = memoryStore.get(`task:${taskId}`);

      if (!taskData) {
        return sendJSON(res, 404, { error: 'Task not found' });
      }

      return sendJSON(res, 200, {
        taskId,
        status: taskData.status,
        progress: taskData.progress || 0,
        step: taskData.step,
        message: taskData.message,
        createdAt: taskData.createdAt,
        completedAt: taskData.completedAt,
        result: taskData.result,
      });
    }

    // GET /metrics
    if (method === 'GET' && path === '/metrics') {
      return sendJSON(res, 200, {
        agent_mode: 'memory',
        agent_tasks_total: memoryStore.size,
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
  console.log(`🚀 Agent Sandbox API running on http://${HOST}:${PORT}`);
  console.log(`📋 Health: http://${HOST}:${PORT}/health`);
  console.log(`✅ Mode: Memory (testing without Redis/Docker)`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});
