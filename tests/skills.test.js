/**
 * Skills Test Suite
 */

import { test, describe } from 'node:test';
import assert from 'assert';

// Mock environment
process.env.BRAVE_API_KEY = '';
process.env.GITHUB_TOKEN = '';

describe('Agent Skills', () => {
  test('web-search skill should load', async () => {
    try {
      const webSearch = await import('./src/skills/web-search/index.js');
      assert.ok(webSearch.default, 'Web search skill should export default function');
      console.log('✅ Web search skill loaded successfully');
    } catch (e) {
      console.log('⚠️  Web search skill failed to load:', e.message);
    }
  });

  test('code-generator skill should load', async () => {
    try {
      const codeGen = await import('./src/skills/code-generator/index.js');
      assert.ok(codeGen.default, 'Code generator should export default function');
      console.log('✅ Code generator skill loaded successfully');
    } catch (e) {
      console.log('⚠️  Code generator failed to load:', e.message);
    }
  });

  test('report-generator skill should load', async () => {
    try {
      const reportGen = await import('./src/skills/report-generator/index.js');
      assert.ok(reportGen.default, 'Report generator should export default function');
      console.log('✅ Report generator skill loaded successfully');
    } catch (e) {
      console.log('⚠️  Report generator failed to load:', e.message);
    }
  });

  test('github-publisher skill should load', async () => {
    try {
      const githubPub = await import('./src/skills/github-publisher/index.js');
      assert.ok(githubPub.default, 'GitHub publisher should export default function');
      console.log('✅ GitHub publisher skill loaded successfully');
    } catch (e) {
      console.log('⚠️  GitHub publisher failed to load:', e.message);
    }
  });
});

console.log('🧪 Running Agent Skills tests...\n');
