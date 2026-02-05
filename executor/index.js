/**
 * Agent Task Executor
 * Consumes tasks from Redis queue and executes in Docker containers
 */

import { Redis } from 'ioredis';
import Dockerode from 'dockerode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
// Slack webhook support - uncomment if needed
// import { WebClient } from '@slack/web-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load configuration
const configPath = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config', 'default.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Initialize services
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const docker = new Dockerode({
  socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock',
});

// Active containers pool
const activeContainers = new Map();
const MAX_CONTAINERS = config.docker.maxContainers || 2;

/**
 * Create a new execution container
 */
async function createContainer(taskId) {
  const containerName = `${config.docker.containerPrefix}${taskId}`;
  
  console.log(`📦 Creating container: ${containerName}`);
  
  const container = await docker.createContainer({
    Image: config.docker.image,
    name: containerName,
    Cmd: ['node', 'executor/task-runner.js', taskId],
    HostConfig: {
      Memory: parseInt(config.docker.memoryLimit) || 256 * 1024 * 1024,
      CpuPeriod: 100000,
      CpuQuota: parseFloat(config.docker.cpuLimit) * 100000 || 50000,
      NetworkMode: 'none',
      AutoRemove: true,
      Binds: [
        `${path.resolve(__dirname, '..', 'workspace')}:/app/workspace:rw`,
        `${path.resolve(__dirname, '..', 'config')}:/app/config:ro`,
      ],
    },
    Env: [
      `TASK_ID=${taskId}`,
      `CONFIG_PATH=${configPath}`,
      `REDIS_URL=${process.env.REDIS_URL || 'redis://localhost:6379'}`,
    ],
    WorkingDir: '/app',
  });

  return container;
}

/**
 * Update task progress
 */
async function updateProgress(taskId, progress) {
  const data = {
    taskId,
    ...progress,
    timestamp: new Date().toISOString(),
  };
  
  // Save to Redis
  await redis.hset(`${config.redis.keyPrefix}task:${taskId}`, {
    progress: progress.progress?.toString() || '0',
    step: progress.step || '',
    message: progress.message || '',
    ...(progress.startedAt && { startedAt: progress.startedAt }),
    ...(progress.completedAt && { completedAt: progress.completedAt }),
  });
  
  // Publish for SSE/WebSocket
  await redis.publish(`${config.redis.keyPrefix}progress:${taskId}`, JSON.stringify(data));
  
  // Send webhook if configured
  const taskData = await redis.hgetall(`${config.redis.keyPrefix}task:${taskId}`);
  if (taskData.webhookUrl) {
    try {
      await fetch(taskData.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    } catch (e) {
      // Ignore webhook errors
    }
  }
  
  console.log(`📊 Progress [${progress.progress || 0}%]: ${progress.step} - ${progress.message}`);
}

/**
 * Execute task in container
 */
async function executeTask(taskId, taskData) {
  console.log(`⚡ Executing task: ${taskId}`);
  
  // Get or create container
  let container = activeContainers.get(taskId);
  
  if (!container) {
    if (activeContainers.size >= MAX_CONTAINERS) {
      throw new Error('Container pool exhausted');
    }
    
    container = await createContainer(taskId);
    activeContainers.set(taskId, container);
  }
  
  // Write task to workspace
  const taskFile = path.join(config.docker.workspacePath, `${taskId}.json`);
  fs.writeFileSync(taskFile, JSON.stringify(taskData, null, 2));
  
  // Start container
  await container.start();
  console.log(`🚀 Container started: ${container.id}`);
  
  // Wait for completion (with timeout)
  const timeout = config.agent.taskTimeout * 1000 || 300000;
  
  try {
    const result = await container.wait();
    console.log(`✅ Task completed with exit code: ${result.StatusCode}`);
    
    // Get logs
    const logs = await container.logs({ stdout: true, stderr: true });
    
    // Read result
    const resultFile = path.join(config.docker.workspacePath, `${taskId}_result.json`);
    let resultData = null;
    
    if (fs.existsSync(resultFile)) {
      resultData = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
    }
    
    return {
      success: result.StatusCode === 0,
      exitCode: result.StatusCode,
      logs: logs.toString(),
      result: resultData,
    };
  } catch (error) {
    console.error(`❌ Task failed: ${error.message}`);
    throw error;
  } finally {
    // Cleanup
    try {
      await container.stop({ t: 0 }).catch(() => {});
      activeContainers.delete(taskId);
      console.log(`🧹 Container cleaned up: ${taskId}`);
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  }
}

/**
 * Process task from queue
 */
async function processTask() {
  try {
    // Get task from queue
    const taskJson = await redis.brpop(config.redis.queues.tasks, 0);
    
    if (!taskJson) return;
    
    const taskData = JSON.parse(taskJson[1]);
    const { id: taskId, task, tools, apiKey, webhookUrl } = taskData;
    
    console.log(`📋 Processing task: ${taskId}`);
    console.log(`   Task: ${task.substring(0, 100)}...`);
    console.log(`   Tools: ${tools.join(', ')}`);
    
    // Update status to running
    await updateProgress(taskId, {
      status: 'running',
      progress: 10,
      step: 'starting',
      message: 'Task started',
      startedAt: new Date().toISOString(),
    });
    
    // Execute
    const startTime = Date.now();
    
    await updateProgress(taskId, {
      status: 'running',
      progress: 30,
      step: 'initializing',
      message: 'Preparing execution environment',
    });
    
    const result = await executeTask(taskId, taskData);
    
    await updateProgress(taskId, {
      status: 'running',
      progress: 90,
      step: 'finalizing',
      message: 'Saving results',
    });
    
    const duration = Date.now() - startTime;
    
    // Save result
    await redis.hset(`${config.redis.keyPrefix}task:${taskId}`, {
      status: result.success ? 'completed' : 'failed',
      result: JSON.stringify(result),
      completedAt: new Date().toISOString(),
      duration: duration.toString(),
      progress: result.success ? '100' : '0',
      step: result.success ? 'completed' : 'failed',
      message: result.success ? 'Task completed successfully' : 'Task failed',
    });
    
    // Final progress update
    await redis.publish(`${config.redis.keyPrefix}progress:${taskId}`, JSON.stringify({
      taskId,
      status: result.success ? 'completed' : 'failed',
      progress: result.success ? 100 : 0,
      step: result.success ? 'completed' : 'failed',
      message: result.success ? 'Task completed' : 'Task failed',
      completedAt: new Date().toISOString(),
      duration,
      timestamp: new Date().toISOString(),
    }));
    
    // Update metrics
    const keyPrefix = apiKey.substring(0, 10);
    if (result.success) {
      await redis.incr(`${config.redis.keyPrefix}usage:${keyPrefix}:completed`);
      await redis.incr(`${config.redis.keyPrefix}metrics:completed`);
    } else {
      await redis.incr(`${config.redis.keyPrefix}usage:${keyPrefix}:failed`);
      await redis.incr(`${config.redis.keyPrefix}metrics:failed`);
    }
    
    console.log(`✅ Task ${taskId} completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Task processing error:', error.message);
    
    // Mark task as failed
    try {
      const taskJson = await redis.lpop(config.redis.queues.tasks);
      if (taskJson) {
        const taskData = JSON.parse(taskJson);
        await updateProgress(taskData.id, {
          status: 'failed',
          progress: 0,
          step: 'error',
          message: error.message,
          completedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to mark task as failed:', e.message);
    }
  }
}

/**
 * Cleanup old containers
 */
async function cleanup() {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { name: [config.docker.containerPrefix] },
    });
    
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      const info = await container.inspect();
      
      // Remove containers older than cleanup time
      const createdAt = new Date(info.Created);
      const age = Date.now() - createdAt.getTime();
      
      if (age > config.agent.cleanupAfterMs) {
        console.log(`🧹 Removing old container: ${containerInfo.Names[0]}`);
        await container.remove({ force: true }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

// Main loop
async function main() {
  console.log('🚀 Agent Executor starting...');
  console.log(`📊 Max concurrent containers: ${MAX_CONTAINERS}`);
  
  // Periodic cleanup every 10 minutes
  setInterval(cleanup, 10 * 60 * 1000);
  
  // Process tasks
  while (true) {
    await processTask();
  }
}

main().catch(console.error);
