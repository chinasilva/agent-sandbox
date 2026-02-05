# 🤖 Agent Sandbox

Lightweight Agent Sandbox - Run AI tasks in isolated Docker containers.

## ✨ Features

- 🔥 **Lightweight** - Optimized for 2GB RAM servers
- 🐳 **Docker Isolation** - Safe execution in containers
- 📦 **Container Pool** - Pre-warmed containers for fast startup
- 🔄 **Task Queue** - Redis-based reliable task processing
- 📊 **Prometheus Metrics** - Built-in monitoring

## 🚀 Quick Start

```bash
# 1. Clone and install
cd agent-sandbox
npm install

# 2. Configure
cp .env.example .env

# 3. Build and run
npm run build:image
npm run up

# 4. Test
curl http://localhost:3000/health
```

## 📡 API Usage

```bash
# Submit a task
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Plan a 7-day trip to Japan",
    "tools": ["web_search", "llm"],
    "apiKey": "your-api-key"
  }'

# Check status
curl http://localhost:3000/api/v1/tasks/{taskId}
```

## 🏗️ Architecture

```
User → API Server → Redis Queue → Executor → Docker Container
                                      ↓
                                 Agent Tools
                                 - Web Search
                                 - LLM
                                 - GitHub
```

## 📦 Resources

| Component | RAM | CPU |
|-----------|-----|-----|
| API Server | 256MB | 0.5 |
| Executor | 128MB | 0.25 |
| Redis | 128MB | 0.25 |
| **Total** | **~512MB** | **~1.0** |

## 📖 Documentation

See [CONFIG.md](CONFIG.md) for detailed documentation.

## 🧪 Testing

```bash
npm test
```

## 📝 License

MIT
