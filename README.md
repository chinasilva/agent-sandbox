# 🤖 Agent Sandbox

**Complete AI Agent with Skills System** - Build, deploy, and manage AI-powered tasks.

## ✨ Features

- 🚀 **Task Execution** - Submit tasks and track progress in real-time
- 🧠 **AI-Powered Skills** - Web search, code generation, report writing
- 📦 **Skill System** - Modular, extensible skill architecture
- 🔄 **Progress Tracking** - Real-time progress updates (10% → 100%)
- 📊 **Metrics** - Prometheus-compatible metrics endpoint
- 🐳 **Docker Ready** - Containerized for easy deployment
- 💾 **Redis Support** - Optional Redis for distributed tasks

## 🎯 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional)
- API Keys (optional):
  - `OPENAI_API_KEY` - For LLM capabilities
  - `BRAVE_API_KEY` - For web search
  - `GITHUB_TOKEN` - For GitHub operations

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/agent-sandbox.git
cd agent-sandbox

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## 📡 API Usage

### Submit a Task

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a landing page for my AI startup",
    "tools": ["code-generator", "github-publisher"],
    "apiKey": "your-api-key"
  }'
```

**Response:**

```json
{
  "taskId": "uuid",
  "status": "pending",
  "message": "Task submitted successfully",
  "pollUrl": "/api/v1/tasks/{taskId}/poll",
  "skills": ["web-search", "code-generator", "report-generator", "github-publisher"]
}
```

### Poll Task Status

```bash
curl http://localhost:3000/api/v1/tasks/{taskId}/poll
```

**Response:**

```json
{
  "taskId": "uuid",
  "status": "completed",
  "progress": 100,
  "step": "completed",
  "message": "Task completed successfully",
  "result": "# Task Results\n## Task\n..."
}
```

### Get Available Skills

```bash
curl http://localhost:3000/api/v1/skills
```

**Response:**

```json
{
  "skills": ["web-search", "code-generator", "report-generator", "github-publisher"],
  "count": 4
}
```

## 🧠 Available Skills

### 1. Web Search (`web-search`)

Search the web for information using Brave API or DuckDuckGo fallback.

```json
{
  "task": "Search for latest AI news",
  "tools": ["web-search"]
}
```

### 2. Code Generator (`code-generator`)

Generate code for various project types.

**Supported Types:**
- HTML/CSS/JS projects
- React components
- Node.js APIs
- Python scripts
- Bash automation

```json
{
  "task": "Create a landing page for my AI startup",
  "tools": ["code-generator"]
}
```

### 3. Report Generator (`report-generator`)

Generate comprehensive reports.

**Report Types:**
- Travel/itinerary reports
- Technical documentation
- Research analysis
- Executive summaries

```json
{
  "task": "Create a 7-day Japan travel plan with budget",
  "tools": ["report-generator"]
}
```

### 4. GitHub Publisher (`github-publisher`)

Publish code to GitHub repositories.

**Operations:**
- Create repositories
- Push code commits
- Create pull requests
- Publish releases

```json
{
  "task": "Create a repo ai-project and push the generated code",
  "tools": ["github-publisher"],
  "apiKey": "ghp_..."
}
```

## 📊 Progress Tracking

Tasks progress through these stages:

```
[10%] analyzing   → Task requirements analyzed
[25%] web-search  → Executing web search
[50%] code-generator → Generating code
[75%] processing  → Processing results
[100%] completed → Task finished
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Sandbox                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   API Server (Port 3000)                                    │
│   ├── Task Submission                                       │
│   ├── Progress Polling                                      │
│   └── Skills Registry                                       │
│                                                              │
│   Skill Engine                                              │
│   ├── web-search         → Search API                       │
│   ├── code-generator    → Code templates                   │
│   ├── report-generator  → Report templates                │
│   └── github-publisher  → GitHub API                      │
│                                                              │
│   Storage (Redis/Memory)                                    │
│   ├── Task Queue                                           │
│   └── Results Cache                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## ⚙️ Configuration

Edit `config/default.json` to customize:

```json
{
  "server": {
    "port": 3000
  },
  "agent": {
    "maxConcurrentTasks": 2,
    "taskTimeout": 300
  },
  "llm": {
    "provider": "openai",
    "models": {
      "fast": "gpt-3.5-turbo",
      "smart": "gpt-4o"
    }
  }
}
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Start development server with auto-reload
npm run dev
```

## 📁 Project Structure

```
agent-sandbox/
├── src/
│   ├── api/
│   │   └── server.js           # Main API server
│   ├── agent/
│   │   └── engine.js          # Task execution engine
│   ├── skills/
│   │   ├── web-search/        # Web search skill
│   │   ├── code-generator/    # Code generation skill
│   │   ├── report-generator/  # Report generation skill
│   │   └── github-publisher/ # GitHub publishing skill
│   └── lib/
│       ├── llm.js             # LLM integration
│       ├── search.js           # Search utilities
│       └── github.js          # GitHub utilities
├── config/
│   └── default.json           # Configuration
├── tests/
│   └── *.test.js             # Unit tests
├── docker-compose.yml         # Docker orchestration
└── package.json
```

## 🔒 Security

- **API Keys**: Store in environment variables or `.env`
- **Authentication**: Simple API key validation
- **Isolation**: Docker containers for task execution
- **Rate Limiting**: Configure limits in `config/default.json`

## 📈 Metrics

Access Prometheus-compatible metrics:

```bash
curl http://localhost:3000/metrics
```

**Available metrics:**
- `agent_skills_total` - Number of loaded skills
- `agent_tasks_total` - Total tasks submitted
- `agent_tasks_completed` - Successfully completed tasks
- `agent_tasks_failed` - Failed tasks

## 🚀 Deployment

### Vercel (Serverless)

```bash
# Deploy API to Vercel Functions
vercel --prod
```

### Docker Swarm

```bash
# Deploy stack
docker stack deploy -c docker-compose.yml agent-sandbox
```

### Kubernetes

```bash
# Apply configurations
kubectl apply -f k8s/
```

## 📝 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your skill to `src/skills/`
4. Submit a pull request

## 📧 Support

- GitHub Issues: Report bugs and request features
- Documentation: See `/docs` directory

---

Built with 🤖 Agent Sandbox
