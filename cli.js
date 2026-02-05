#!/usr/bin/env node

/**
 * Agent Sandbox CLI Client
 * Simple command-line interface to interact with the API
 */

import http from 'http';

const API_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Make HTTP request
 */
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Submit a task
 */
async function submitTask(task, tools = ['llm'], apiKey = 'test-key') {
  console.log(`\n📤 Submitting task: "${task.substring(0, 50)}..."`);
  
  const res = await request('POST', '/api/v1/tasks', {
    task,
    tools,
    apiKey,
  });

  if (res.status !== 200) {
    console.error('❌ Failed:', res.body.error);
    return null;
  }

  console.log(`✅ Task submitted: ${res.body.taskId}`);
  return res.body.taskId;
}

/**
 * Poll for task result WITH progress
 */
async function waitForResult(taskId, maxWaitMs = 60000) {
  const startTime = Date.now();
  let lastProgress = -1;
  
  while (Date.now() - startTime < maxWaitMs) {
    const res = await request('GET', `/api/v1/tasks/${taskId}/poll`);
    
    if (res.status === 404) {
      console.error('❌ Task not found');
      return null;
    }

    const { status, progress, step, message, createdAt, completedAt } = res.body;
    
    // Only log if progress changed
    if (progress !== lastProgress) {
      lastProgress = progress;
      console.log(`📊 [${progress || 0}%] ${step}: ${message}`);
    }

    if (status === 'completed') {
      console.log(`\n✅ Task completed!`);
      console.log(`⏱️  Duration: ${new Date(completedAt) - new Date(createdAt)}ms`);
      console.log(`\n📄 Result:\n`);
      console.log(res.body.result?.output || JSON.stringify(res.body.result, null, 2));
      return res.body.result;
    }

    if (status === 'failed') {
      console.error('❌ Task failed:', res.body.result?.error || 'Unknown error');
      return null;
    }

    // Wait 2 seconds before polling again
    await new Promise(r => setTimeout(r, 2000));
  }

  console.error('⏱️  Task timed out');
  return null;
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    console.log('🤖 Agent Sandbox CLI');
    console.log('====================\n');
    console.log('Usage:');
    console.log('  node cli.js "task description"');
    console.log('  node cli.js "task" tools=web_search,llm\n');
    
    // Example: Travel plan
    const taskId = await submitTask(
      'Plan a 7-day trip to Japan with budget and must-visit places',
      ['web_search', 'llm']
    );
    
    if (taskId) {
      await waitForResult(taskId);
    }
    return;
  }

  // Parse arguments
  const task = args[0];
  const tools = args.find(a => a.startsWith('tools='))?.split('=')[1]?.split(',') || ['llm'];

  const taskId = await submitTask(task, tools);
  
  if (taskId) {
    await waitForResult(taskId);
  }
}

main().catch(console.error);
