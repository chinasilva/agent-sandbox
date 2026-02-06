/**
 * Vercel Serverless API Entry Point
 * Simplified version for Vercel serverless environment
 * Note: User registration/login requires a persistent database (use local server)
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Parse URL
  const url = new URL(req.url || '/', `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Health check
    if (pathname === '/health' && method === 'GET') {
      return res.json({
        status: 'healthy',
        mode: 'vercel-serverless',
        skills: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
        skillsList: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
        timestamp: new Date().toISOString(),
      });
    }

    // List skills
    if (pathname === '/api/v1/skills' && method === 'GET') {
      return res.json({
        skills: ['web-search', 'code-generator', 'report-generator', 'github-publisher'],
        count: 4,
      });
    }

    // Register - Returns info message (auth requires local server)
    if (pathname === '/api/v1/auth/register' && method === 'POST') {
      return res.status(503).json({
        error: 'Registration requires local server',
        message: 'For full user system, please run the server locally: npm start',
        localUrl: 'http://localhost:3000',
        instructions: [
          '1. Clone the repository',
          '2. Run: npm install',
          '3. Run: npm start',
          '4. Open: http://localhost:3000',
        ],
      });
    }

    // Login - Returns info message
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      return res.status(503).json({
        error: 'Login requires local server',
        message: 'For full user system, please run the server locally: npm start',
        localUrl: 'http://localhost:3000',
      });
    }

    // Metrics
    if (pathname === '/metrics' && method === 'GET') {
      return res.json({
        agent_mode: 'vercel-serverless',
        agent_skills_total: 4,
        agent_timestamp: Date.now(),
      });
    }

    // User tasks - Requires auth
    if (pathname === '/api/v1/user/tasks' && method === 'GET') {
      return res.status(503).json({
        error: 'User features require local server',
        message: 'Please run the server locally for full functionality',
        localUrl: 'http://localhost:3000',
      });
    }

    // Submit task - Requires auth
    if (pathname === '/api/v1/tasks' && method === 'POST') {
      return res.status(503).json({
        error: 'Task submission requires local server',
        message: 'Please run the server locally for full functionality',
        localUrl: 'http://localhost:3000',
      });
    }

    // API info for root
    if (pathname === '/' || pathname === '/api') {
      return res.json({
        name: 'Agent Sandbox API',
        version: '1.0.0',
        mode: 'vercel-serverless',
        description: 'AI-powered task execution platform',
        endpoints: {
          'GET /': 'This info',
          'GET /health': 'Health check',
          'GET /api/v1/skills': 'List available skills',
          'GET /metrics': 'Prometheus metrics',
          'POST /api/v1/auth/register': 'Register user (requires local server)',
          'POST /api/v1/auth/login': 'Login (requires local server)',
          'POST /api/v1/tasks': 'Submit task (requires local server)',
          'GET /api/v1/user/tasks': 'User task history (requires local server)',
        },
        skills: {
          'web-search': 'Internet search using Brave/DuckDuckGo',
          'code-generator': 'Generate HTML/React/API code',
          'report-generator': 'Generate travel/technical/research reports',
          'github-publisher': 'Push code, create PRs, releases to GitHub',
        },
        note: 'For full functionality (user system, task execution), run locally: npm start',
        github: 'https://github.com/chinasilva/agent-sandbox',
      });
    }

    // 404 for unknown routes
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${method} ${pathname} not found`,
      availableRoutes: [
        'GET /',
        'GET /health',
        'GET /api/v1/skills',
        'GET /metrics',
      ],
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
