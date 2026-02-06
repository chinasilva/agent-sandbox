/**
 * User System Integration Tests
 * Tests for user registration, login, credits, and task submission with auth
 * 
 * Run with: node --test tests/user-system.test.js
 * 
 * Prerequisites:
 * 1. Start server: npm start
 * 2. Server must be running on http://localhost:3000
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Test user data - use unique username for each test run
const testUser = {
  username: `testuser_${Date.now()}`,
  password: 'testpassword123',
};

let accessToken = null;
let refreshToken = null;
let testUserId = null;

describe('User System Integration Tests', () => {
  test('1. Server should be running', async () => {
    const res = await fetch(`${API_BASE}/health`);
    assert.strictEqual(res.status, 200, 'Server should respond');
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy', 'Server should be healthy');
    console.log('✅ Server is running');
  });

  test('2. User registration should work', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });

    assert.strictEqual(res.status, 201, 'Registration should return 201');
    const data = await res.json();
    assert.ok(data.accessToken, 'Should return access token');
    assert.strictEqual(data.user.credits, 100, 'New user should have 100 credits');

    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    testUserId = data.user.id;
    console.log(`✅ User registered: ${testUser.username}`);
  });

  test('3. Duplicate username should fail', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username,
        password: 'anotherpassword',
      }),
    });

    assert.strictEqual(res.status, 409, 'Duplicate should fail');
    console.log('✅ Duplicate registration rejected');
  });

  test('4. User login should work', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
      }),
    });

    assert.strictEqual(res.status, 200, 'Login should succeed');
    console.log('✅ Login successful');
  });

  test('5. User profile should be accessible', async () => {
    const res = await fetch(`${API_BASE}/api/v1/user/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.strictEqual(res.status, 200, 'Profile should be accessible');
    console.log('✅ Profile loaded');
  });

  test('6. Task submission should require auth', async () => {
    const res = await fetch(`${API_BASE}/api/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'Test task', tools: ['code-generator'] }),
    });

    assert.strictEqual(res.status, 401, 'Unauthenticated should fail');
    console.log('✅ Unauthenticated request rejected');
  });

  test('7. Task submission should work with auth', async () => {
    const res = await fetch(`${API_BASE}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        task: 'Create a simple HTML page',
        tools: ['code-generator'],
      }),
    });

    assert.strictEqual(res.status, 200, 'Task should submit');
    const data = await res.json();
    assert.ok(data.taskId, 'Should return task ID');
    assert.ok(typeof data.remainingCredits === 'number', 'Should have credits');
    console.log(`✅ Task submitted, remaining credits: ${data.remainingCredits}`);
  });

  test('8. Task history should be accessible', async () => {
    const res = await fetch(`${API_BASE}/api/v1/user/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.strictEqual(res.status, 200, 'History should be accessible');
    const data = await res.json();
    assert.ok(Array.isArray(data.tasks), 'Should return tasks');
    console.log(`✅ Task history: ${data.tasks.length} tasks`);
  });

  test('9. Skills endpoint should be public', async () => {
    const res = await fetch(`${API_BASE}/api/v1/skills`);

    assert.strictEqual(res.status, 200, 'Skills should be public');
    const data = await res.json();
    assert.ok(data.skills.length > 0, 'Should have skills');
    console.log(`✅ Skills: ${data.skills.join(', ')}`);
  });

  test('10. Invalid token should be rejected', async () => {
    const res = await fetch(`${API_BASE}/api/v1/user/profile`, {
      headers: { Authorization: 'Bearer invalid_token' },
    });

    assert.strictEqual(res.status, 401, 'Invalid token should fail');
    console.log('✅ Invalid token rejected');
  });
});

console.log('\n🧪 User System Tests Ready');
console.log('Run: node --test tests/user-system.test.js\n');
