/**
 * User Database Layer
 * Using sql.js (pure JavaScript SQLite implementation)
 * No native compilation required!
 */

import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'users.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

/**
 * Initialize database
 */
export async function initDatabase() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  // Try to load existing database
  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('✅ Database loaded from file');
    } else {
      db = new SQL.Database();
      console.log('✅ New database created');
    }
  } catch (e) {
    db = new SQL.Database();
    console.log('✅ Fresh database created');
  }
  
  // Initialize tables
  db.run(`
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
  `);
  
  db.run(`
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
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create indexes
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  } catch (e) {
    // Indexes might already exist
  }
  
  saveDatabase();
  return db;
}

/**
 * Save database to file
 */
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Execute query and return results
 */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Execute without returning results
 */
function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
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
    run(
      `INSERT INTO users (id, username, password_hash, api_key, credits, is_admin) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, username, passwordHash, apiKey, 100, 0]
    );
    
    return {
      id,
      username,
      apiKey,
      credits: 100,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
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
  const results = query('SELECT * FROM users WHERE username = ?', [username]);
  return results[0] || null;
}

/**
 * Find user by ID
 */
export async function findUserById(id) {
  await initDatabase();
  const results = query('SELECT id, username, api_key, credits, is_admin, created_at, updated_at FROM users WHERE id = ?', [id]);
  return results[0] || null;
}

/**
 * Find user by API key
 */
export async function findUserByApiKey(apiKey) {
  await initDatabase();
  const results = query('SELECT * FROM users WHERE api_key = ?', [apiKey]);
  return results[0] || null;
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
  run('UPDATE users SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newApiKey, userId]);
  return newApiKey;
}

/**
 * Update user credits
 */
export async function updateCredits(userId, amount, description = '') {
  await initDatabase();
  const transactionId = uuidv4();
  
  run(
    `INSERT INTO credit_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)`,
    [transactionId, userId, amount, amount > 0 ? 'credit' : 'debit', description]
  );
  
  run('UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [amount, userId]);
  
  return await findUserById(userId);
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
  const results = query('SELECT credits FROM users WHERE id = ?', [userId]);
  return results[0]?.credits || 0;
}

/**
 * Get user's task history
 */
export async function getUserTasks(userId, limit = 20, offset = 0) {
  await initDatabase();
  const results = query(
    `SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  
  return results.map(task => ({
    ...task,
    tools: JSON.parse(task.tools || '[]'),
  }));
}

/**
 * Get total task count for user
 */
export async function getUserTaskCount(userId) {
  await initDatabase();
  const results = query('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [userId]);
  return results[0]?.count || 0;
}

/**
 * Create a new task
 */
export async function createTask(userId, task, tools = []) {
  await initDatabase();
  
  const id = uuidv4();
  
  run(
    `INSERT INTO tasks (id, user_id, task, tools, status, progress, step, message) VALUES (?, ?, ?, ?, 'pending', 0, 'queued', 'Task queued')`,
    [id, userId, task, JSON.stringify(tools)]
  );
  
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
      setClause.push(`${key} = ?`);
      values.push(key === 'tools' ? JSON.stringify(value) : value);
    }
  }
  
  if (setClause.length === 0) return;
  
  setClause.push("updated_at = CURRENT_TIMESTAMP");
  values.push(taskId);
  
  run(`UPDATE tasks SET ${setClause.join(', ')} WHERE id = ?`, values);
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId) {
  await initDatabase();
  const results = query('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (results[0]) {
    results[0].tools = JSON.parse(results[0].tools || '[]');
  }
  return results[0] || null;
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers() {
  await initDatabase();
  return query('SELECT id, username, credits, is_admin, created_at FROM users ORDER BY created_at DESC');
}

/**
 * Check if username exists
 */
export async function usernameExists(username) {
  await initDatabase();
  const results = query('SELECT 1 FROM users WHERE username = ?', [username]);
  return results.length > 0;
}

/**
 * Get user statistics
 */
export async function getUserStats(userId) {
  await initDatabase();
  const results = query(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
      SUM(credits_used) as total_credits_used
    FROM tasks
    WHERE user_id = ?
  `, [userId]);
  
  const stats = results[0] || {};
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
