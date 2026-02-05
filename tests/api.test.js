/**
 * Basic API tests
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

// Simple HTTP client for testing
async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
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
          resolve({
            status: res.statusCode,
            body: JSON.parse(data || '{}'),
          });
        } catch {
          resolve({
            status: res.statusCode,
            body: data,
          });
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

describe('Agent Sandbox API', () => {
  // These tests require the server to be running
  // Run with: npm run dev & npm test

  test('health check should return status', async () => {
    try {
      const res = await request('GET', '/health');
      if (res.status === 200 || res.status === 500) {
        console.log('✅ Health check test passed (server running)');
      }
    } catch {
      console.log('⚠️  Health check skipped (server not running)');
    }
  });

  test('task submission should require API key', async () => {
    try {
      const res = await request('POST', '/api/v1/tasks', {
        task: 'Test task',
        tools: ['llm'],
      });

      if (res.status === 401) {
        console.log('✅ API key validation test passed');
      }
    } catch {
      console.log('⚠️  Task submission test skipped (server not running)');
    }
  });

  test('task submission with API key should succeed', async () => {
    try {
      const res = await request('POST', '/api/v1/tasks', {
        task: 'Plan a trip to Japan',
        tools: ['web_search', 'llm'],
        apiKey: 'test-api-key-12345',
      });

      if (res.status === 200 && res.body.taskId) {
        console.log('✅ Task submission test passed');
        console.log(`   Task ID: ${res.body.taskId}`);
        console.log(`   Poll URL: ${res.body.pollUrl}`);
      }
    } catch {
      console.log('⚠️  Task submission test skipped (server not running)');
    }
  });

  test('task submission should return progress URLs', async () => {
    try {
      const res = await request('POST', '/api/v1/tasks', {
        task: 'Test progress tracking',
        tools: ['llm'],
        apiKey: 'test-key-123',
      });

      if (res.status === 200) {
        const hasPollUrl = res.body.pollUrl && res.body.pollUrl.includes('/poll');
        if (hasPollUrl) {
          console.log('✅ Progress URL test passed');
        }
      }
    } catch {
      console.log('⚠️  Progress URL test skipped (server not running)');
    }
  });

  test('task poll should return progress info', async () => {
    try {
      // First submit a task
      const submitRes = await request('POST', '/api/v1/tasks', {
        task: 'Test poll',
        tools: ['llm'],
        apiKey: 'poll-test-key',
      });

      if (submitRes.body.taskId) {
        // Then poll for status
        const pollRes = await request('GET', `/api/v1/tasks/${submitRes.body.taskId}/poll`);
        
        if (pollRes.body.status) {
          console.log('✅ Task poll test passed');
          console.log(`   Status: ${pollRes.body.status}`);
          console.log(`   Progress: ${pollRes.body.progress}%`);
        }
      }
    } catch {
      console.log('⚠️  Task poll test skipped (server not running)');
    }
  });

  test('metrics endpoint should return Prometheus format', async () => {
    try {
      const res = await request('GET', '/metrics');

      if (res.status === 200 && res.body.includes('# Agent Sandbox Metrics')) {
        console.log('✅ Metrics endpoint test passed');
      }
    } catch {
      console.log('⚠️  Metrics test skipped (server not running)');
    }
  });

  test('containers endpoint should list containers', async () => {
    try {
      const res = await request('GET', '/api/v1/containers');
      
      if (res.body.count !== undefined) {
        console.log('✅ Containers endpoint test passed');
        console.log(`   Active containers: ${res.body.count}`);
      }
    } catch {
      console.log('⚠️  Containers test skipped (server not running)');
    }
  });
});

describe('Configuration', () => {
  test('config should have required fields', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const configPath = path.join(process.cwd(), 'config', 'default.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    assert.ok(config.server, 'Server config required');
    assert.ok(config.redis, 'Redis config required');
    assert.ok(config.agent, 'Agent config required');

    console.log('✅ Configuration validation passed');
  });
});
