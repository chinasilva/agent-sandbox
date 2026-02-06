/**
 * User Database Layer - Vercel Postgres Version
 * Supports both local SQLite and Vercel Postgres
 */

import { sql, createPool } from '@vercel/postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if we're on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.DATABASE_URL;

// Database initialization
let initialized = false;

/**
 * Initialize database tables
 */
export async function initDatabase() {
  if (initialized) return;
  
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        credits INTEGER DEFAULT 100,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create tasks table
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task TEXT NOT NULL,
        tools TEXT,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        step TEXT,
        message TEXT,
        result TEXT,
        credits_used INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create credit_transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create indexes
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`;
    } catch (e) {
      // Indexes might already exist
    }
    
    initialized = true;
    console.log('✅ Vercel Postgres database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

/**
 * Generate a new API key
 */
function generateApiKey() {
  return `ask_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Create a new user
 */
export async function createUser(username, password) {
  await initDatabase();
  
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const apiKey = generateApiKey();
  
  try {
    const result = await sql`
      INSERT INTO users (id, username, password_hash, api_key, credits, is_admin)
      VALUES (${id}, ${username}, ${passwordHash}, ${apiKey}, 100, 0)
      RETURNING id, username, api_key, credits, is_admin, created_at
    `;
    
    const user = result.rows[0];
    return {
      id: user.id,
      username: user.username,
      apiKey: user.api_key,
      credits: user.credits,
      isAdmin: user.is_admin === 1,
      createdAt: user.created_at,
    };
  } catch (error) {
    if (error.message?.includes('duplicate key')) {
      throw new Error('Username already exists');
    }
    throw error;
  }
}

/**
 * Find user by username
 */
export async function findUserByUsername(username) {
  await initDatabase();
  const result = await sql`SELECT * FROM users WHERE username = ${username}`;
  return result.rows[0] || null;
}

/**
 * Find user by ID
 */
export async function findUserById(id) {
  await initDatabase();
  const result = await sql`
    SELECT id, username, api_key, credits, is_admin, created_at, updated_at 
    FROM users WHERE id = ${id}
  `;
  return result.rows[0] || null;
}

/**
 * Find user by API key
 */
export async function findUserByApiKey(apiKey) {
  await initDatabase();
  const result = await sql`SELECT * FROM users WHERE api_key = ${apiKey}`;
  return result.rows[0] || null;
}

/**
 * Validate user password
 */
export async function validatePassword(username, password) {
  const user = await findUserByUsername(username);
  if (!user) return null;
  
  if (bcrypt.compareSync(password, user.password_hash)) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
  return null;
}

/**
 * Regenerate user's API key
 */
export async function regenerateApiKey(userId) {
  await initDatabase();
  const newApiKey = generateApiKey();
  await sql`
    UPDATE users SET api_key = ${newApiKey}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ${userId}
  `;
  return newApiKey;
}

/**
 * Update user credits
 */
export async function updateCredits(userId, amount, description = '') {
  await initDatabase();
  const transactionId = uuidv4();
  
  // Add transaction record
  await sql`
    INSERT INTO credit_transactions (id, user_id, amount, type, description)
    VALUES (${transactionId}, ${userId}, ${amount}, ${amount > 0 ? 'credit' : 'debit'}, ${description})
  `;
  
  // Update user credits
  const result = await sql`
    UPDATE users SET credits = credits + ${amount}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ${userId}
    RETURNING id, username, credits
  `;
  
  return result.rows[0];
}

/**
 * Deduct credits for task
 */
export async function deductTaskCredits(userId) {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (user.credits <= 0) {
    return { success: false, error: 'Insufficient credits' };
  }
  
  const updatedUser = await updateCredits(userId, -1, 'Task execution');
  return { success: true, user: updatedUser };
}

/**
 * Get user's credit balance
 */
export async function getCredits(userId) {
  await initDatabase();
  const result = await sql`SELECT credits FROM users WHERE id = ${userId}`;
  return result.rows[0]?.credits || 0;
}

/**
 * Get user's task history
 */
export async function getUserTasks(userId, limit = 20, offset = 0) {
  await initDatabase();
  const result = await sql`
    SELECT * FROM tasks 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  return result.rows.map(task => ({
    ...task,
    tools: JSON.parse(task.tools || '[]'),
  }));
}

/**
 * Get total task count for user
 */
export async function getUserTaskCount(userId) {
  await initDatabase();
  const result = await sql`SELECT COUNT(*) as count FROM tasks WHERE user_id = ${userId}`;
  return result.rows[0]?.count || 0;
}

/**
 * Create a new task
 */
export async function createTask(userId, task, tools = []) {
  await initDatabase();
  
  const id = uuidv4();
  
  await sql`
    INSERT INTO tasks (id, user_id, task, tools, status, progress, step, message)
    VALUES (${id}, ${userId}, ${task}, ${JSON.stringify(tools)}, 'pending', 0, 'queued', 'Task queued')
  `;
  
  return {
    id,
    userId,
    task,
    tools,
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Update task status and progress
 */
export async function updateTask(taskId, updates) {
  await initDatabase();
  
  const allowedFields = ['status', 'progress', 'step', 'message', 'result'];
  const setClause = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClause.push(`${key} = ${key === 'tools' ? '$' + (values.length + 1) : '$' + (values.length + 1)}`);
      values.push(key === 'tools' ? JSON.stringify(value) : value);
    }
  }
  
  if (setClause.length === 0) return;
  
  setClause.push("updated_at = CURRENT_TIMESTAMP");
  values.push(taskId);
  
  await sql`
    UPDATE tasks SET ${setClause.join(', ')} WHERE id = $${values.length}
  `;
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId) {
  await initDatabase();
  const result = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;
  if (result.rows[0]) {
    result.rows[0].tools = JSON.parse(result.rows[0].tools || '[]');
  }
  return result.rows[0] || null;
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers() {
  await initDatabase();
  const result = await sql`
    SELECT id, username, credits, is_admin, created_at 
    FROM users ORDER BY created_at DESC
  `;
  return result.rows;
}

/**
 * Check if username exists
 */
export async function usernameExists(username) {
  await initDatabase();
  const result = await sql`SELECT 1 FROM users WHERE username = ${username}`;
  return result.rows.length > 0;
}

/**
 * Get user statistics
 */
export async function getUserStats(userId) {
  await initDatabase();
  const result = await sql`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
      SUM(credits_used) as total_credits_used
    FROM tasks WHERE user_id = ${userId}
  `;
  
  const stats = result.rows[0] || {};
  return {
    total_tasks: stats.total_tasks || 0,
    completed_tasks: stats.completed_tasks || 0,
    failed_tasks: stats.failed_tasks || 0,
    total_credits_used: stats.total_credits_used || 0,
  };
}

export default {
  initDatabase,
  createUser,
  findUserByUsername,
  findUserById,
  findUserByApiKey,
  validatePassword,
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
  usernameExists,
  getUserStats,
};
