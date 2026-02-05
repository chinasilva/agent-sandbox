/**
 * Authentication Middleware
 * JWT and API Key validation for secure access
 */

import jwt from 'jsonwebtoken';
import { findUserByApiKey, findUserById } from '../db/user.js';

const JWT_SECRET = process.env.JWT_SECRET || 'agent-sandbox-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 * @param {object} user - User object
 * @param {string} type - Token type ('access' or 'refresh')
 * @returns {string} JWT token
 */
export function generateToken(user, type = 'access') {
  const expiresIn = type === 'refresh' ? JWT_REFRESH_EXPIRES_IN : JWT_EXPIRES_IN;
  
  const payload = {
    userId: user.id,
    username: user.username,
    isAdmin: user.is_admin || false,
    type,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null
 */
export function extractToken(authHeader) {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);
  
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_TOKEN',
    });
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
  
  if (decoded.type !== 'access') {
    return res.status(401).json({
      error: 'Invalid token type',
      code: 'INVALID_TOKEN_TYPE',
    });
  }
  
  // Attach user to request
  req.user = {
    id: decoded.userId,
    username: decoded.username,
    isAdmin: decoded.isAdmin,
  };
  
  next();
}

/**
 * Optional Auth Middleware
 * Attaches user if token is valid, but doesn't require auth
 */
export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.type === 'access') {
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        isAdmin: decoded.isAdmin,
      };
    }
  }
  
  next();
}

/**
 * API Key Authentication Middleware
 * Validates API key from X-API-Key header or query parameter
 */
export function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'NO_API_KEY',
    });
  }
  
  const user = findUserByApiKey(apiKey);
  
  if (!user) {
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
    });
  }
  
  // Attach user to request (without sensitive data)
  const { password_hash, ...safeUser } = user;
  req.user = safeUser;
  req.authMethod = 'api_key';
  
  next();
}

/**
 * Combined Auth Middleware
 * Accepts either JWT or API Key authentication
 */
export function combinedAuthMiddleware(req, res, next) {
  // Try JWT first
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.type === 'access') {
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        isAdmin: decoded.isAdmin,
      };
      req.authMethod = 'jwt';
      return next();
    }
  }
  
  // Try API Key
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (apiKey) {
    const user = findUserByApiKey(apiKey);
    if (user) {
      const { password_hash, ...safeUser } = user;
      req.user = safeUser;
      req.authMethod = 'api_key';
      return next();
    }
  }
  
  return res.status(401).json({
    error: 'Authentication required',
    code: 'NO_AUTH',
  });
}

/**
 * Admin Only Middleware
 * Requires admin privileges
 */
export function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_AUTH',
    });
  }
  
  if (!req.user.isAdmin) {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  }
  
  next();
}

/**
 * Credit Check Middleware
 * Ensures user has credits before allowing action
 */
export function creditCheckMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_AUTH',
    });
  }
  
  const { getCredits } = require('../db/user.js');
  const credits = getCredits(req.user.id);
  
  if (credits <= 0) {
    return res.status(402).json({
      error: 'Insufficient credits',
      code: 'NO_CREDITS',
      currentCredits: credits,
    });
  }
  
  req.userCredits = credits;
  next();
}

/**
 * Generate tokens pair
 * @param {object} user - User object
 * @returns {object} Access and refresh tokens
 */
export function generateTokenPair(user) {
  return {
    accessToken: generateToken(user, 'access'),
    refreshToken: generateToken(user, 'refresh'),
    expiresIn: JWT_EXPIRES_IN,
  };
}

export default {
  generateToken,
  verifyToken,
  extractToken,
  authMiddleware,
  optionalAuthMiddleware,
  apiKeyMiddleware,
  combinedAuthMiddleware,
  adminMiddleware,
  creditCheckMiddleware,
  generateTokenPair,
};
