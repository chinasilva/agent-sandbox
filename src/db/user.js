/**
 * User Database Layer
 * SQLite-based user and task management for small teams (~10 users)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'users.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    credits INTEGER DEFAULT 100,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Tasks table
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
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Credit transactions table
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
`);

/**
 * Generate a new API key
 */
function generateApiKey() {
  return `ask_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Create a new user
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {object} Created user (without password hash)
 */
export function createUser(username, password) {
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const apiKey = generateApiKey();

  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, api_key, credits, is_admin)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(id, username, passwordHash, apiKey, 100, 0);
    
    return {
      id,
      username,
      apiKey,
      credits: 100,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Username already exists');
    }
    throw error;
  }
}

/**
 * Find user by username
 * @param {string} username - Username
 * @returns {object|null} User object
 */
export function findUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) || null;
}

/**
 * Find user by ID
 * @param {string} id - User ID
 * @returns {object|null} User object
 */
export function findUserById(id) {
  const stmt = db.prepare('SELECT id, username, api_key, credits, is_admin, created_at, updated_at FROM users WHERE id = ?');
  return stmt.get(id) || null;
}

/**
 * Find user by API key
 * @param {string} apiKey - API key
 * @returns {object|null} User object
 */
export function findUserByApiKey(apiKey) {
  const stmt = db.prepare('SELECT * FROM users WHERE api_key = ?');
  return stmt.get(apiKey) || null;
}

/**
 * Validate user password
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {object|null} User object if valid, null otherwise
 */
export function validatePassword(username, password) {
  const user = findUserByUsername(username);
  if (!user) return null;
  
  if (bcrypt.compareSync(password, user.password_hash)) {
    // Return user without sensitive data
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
  return null;
}

/**
 * Regenerate user's API key
 * @param {string} userId - User ID
 * @returns {string} New API key
 */
export function regenerateApiKey(userId) {
  const newApiKey = generateApiKey();
  const stmt = db.prepare('UPDATE users SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(newApiKey, userId);
  return newApiKey;
}

/**
 * Update user credits
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add (positive) or subtract (negative)
 * @param {string} description - Transaction description
 * @returns {object} Updated user
 */
export function updateCredits(userId, amount, description = '') {
  const transactionId = uuidv4();
  
  // Start transaction
  const transaction = db.transaction(() => {
    // Add transaction record
    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, amount, type, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(transactionId, userId, amount, amount > 0 ? 'credit' : 'debit', description);

    // Update user credits
    const stmt = db.prepare('UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(amount, userId);
  });

  transaction();

  return findUserById(userId);
}

/**
 * Deduct credits for task
 * @param {string} userId - User ID
 * @returns {object} Result with success status and updated user
 */
export function deductTaskCredits(userId) {
  const user = findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (user.credits <= 0) {
    return { success: false, error: 'Insufficient credits' };
  }

  const updatedUser = updateCredits(userId, -1, 'Task execution');
  return { success: true, user: updatedUser };
}

/**
 * Get user's credit balance
 * @param {string} userId - User ID
 * @returns {number} Credit balance
 */
export function getCredits(userId) {
  const stmt = db.prepare('SELECT credits FROM users WHERE id = ?');
  const user = stmt.get(userId);
  return user ? user.credits : 0;
}

/**
 * Get user's task history
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of tasks to return
 * @param {number} offset - Offset for pagination
 * @returns {Array} List of tasks
 */
export function getUserTasks(userId, limit = 20, offset = 0) {
  const stmt = db.prepare(`
    SELECT id, task, tools, status, progress, step, message, result, credits_used, created_at, updated_at
    FROM tasks
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset);
}

/**
 * Get total task count for user
 * @param {string} userId - User ID
 * @returns {number} Task count
 */
export function getUserTaskCount(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?');
  const result = stmt.get(userId);
  return result ? result.count : 0;
}

/**
 * Create a new task
 * @param {string} userId - User ID
 * @param {string} task - Task description
 * @param {Array} tools - List of tools to use
 * @returns {object} Created task
 */
export function createTask(userId, task, tools = []) {
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO tasks (id, user_id, task, tools, status, progress, step, message)
    VALUES (?, ?, ?, ?, 'pending', 0, 'queued', 'Task queued')
  `);
  
  stmt.run(id, userId, task, JSON.stringify(tools));
  
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
 * @param {string} taskId - Task ID
 * @param {object} updates - Fields to update
 */
export function updateTask(taskId, updates) {
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
  
  const stmt = db.prepare(`UPDATE tasks SET ${setClause.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

/**
 * Get task by ID
 * @param {string} taskId - Task ID
 * @returns {object|null} Task object
 */
export function getTaskById(taskId) {
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const task = stmt.get(taskId);
  if (task) {
    task.tools = JSON.parse(task.tools || '[]');
  }
  return task || null;
}

/**
 * Get all users (admin only)
 * @returns {Array} List of users
 */
export function getAllUsers() {
  const stmt = db.prepare('SELECT id, username, credits, is_admin, created_at FROM users ORDER BY created_at DESC');
  return stmt.all();
}

/**
 * Check if username exists
 * @param {string} username - Username
 * @returns {boolean} True if exists
 */
export function usernameExists(username) {
  const stmt = db.prepare('SELECT 1 FROM users WHERE username = ?');
  return stmt.get(username) !== undefined;
}

/**
 * Get user statistics
 * @param {string} userId - User ID
 * @returns {object} Statistics
 */
export function getUserStats(userId) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
      SUM(credits_used) as total_credits_used
    FROM tasks
    WHERE user_id = ?
  `);
  return stmt.get(userId) || { total_tasks: 0, completed_tasks: 0, failed_tasks: 0, total_credits_used: 0 };
}

export default {
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
