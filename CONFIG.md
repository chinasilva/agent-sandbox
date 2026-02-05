# Agent Sandbox - 项目配置

## 📁 项目位置
```
/root/.openclaw/workspace/aicode/agent-sandbox/
```

## 🌐 访问地址

| 环境 | 地址 | 说明 |
|------|------|------|
| 本地开发 | http://localhost:3000 | API 服务 |
| 健康检查 | http://localhost:3000/health | 服务状态 |
| API 文档 | http://localhost:3000/api/v1/tasks | 任务提交 |

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Sandbox                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   用户浏览器                                                 │
│       │                                                     │
│       ▼                                                     │
│   API Server (Hono)                                        │
│   ├── POST /api/v1/tasks    → 提交任务                      │
│   ├── GET /api/v1/tasks/:id/poll → 查询进度                 │
│   ├── GET /api/v1/skills    → 可用技能列表                 │
│   └── GET /metrics           → Prometheus 指标               │
│       │                                                     │
│       ▼                                                     │
│   Skills Engine                                            │
│   ├── web-search        → 搜索互联网                       │
│   ├── code-generator    → 生成代码                          │
│   ├── report-generator  → 生成报告                          │
│   └── github-publisher   → GitHub 操作                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| API 框架 | Node.js + HTTP | 轻量 Web 服务 |
| 任务存储 | Redis/Memory | 任务队列 |
| AI 集成 | OpenAI API | LLM 推理 |
| 搜索 | Brave/DuckDuckGo | Web 搜索 |
| GitHub | Octokit | 代码托管 |
| 部署 | Docker | 容器化 |

---

## ⚙️ 配置项说明

### 默认配置 (`config/default.json`)

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  
  "redis": {
    "host": "redis",
    "port": 6379,
    "keyPrefix": "agent:"
  },
  
  "agent": {
    "maxConcurrentTasks": 2,
    "taskTimeout": 300,
    "cleanupAfterMs": 3600000,
    "defaultModel": "gpt-4o",
    "fallbackModel": "gpt-3.5-turbo"
  },
  
  "llm": {
    "provider": "openai",
    "models": {
      "fast": "gpt-3.5-turbo",
      "smart": "gpt-4o"
    }
  },
  
  "search": {
    "provider": "brave",
    "maxResults": 10
  },
  
  "skills": {
    "enabled": [
      "web-search",
      "code-generator",
      "report-generator",
      "github-publisher"
    ]
  }
}
```

---

## 🔑 环境变量

创建 `.env` 文件：

```bash
# API Keys（可选，用于增强功能）
OPENAI_API_KEY=sk-...
BRAVE_API_KEY=...
GITHUB_TOKEN=ghp_...

# Redis（Docker 自动配置）
REDIS_URL=redis://redis:6379

# 服务器
PORT=3000
NODE_ENV=development
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /root/.openclaw/workspace/aicode/agent-sandbox
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 添加 API keys
```

### 3. 启动服务

```bash
# 开发模式（自动重载）
npm run dev

# 生产模式
npm start
```

### 4. 测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# 查看可用技能
curl http://localhost:3000/api/v1/skills

# 提交任务
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a landing page for my AI startup",
    "tools": ["code-generator"],
    "apiKey": "test-key"
  }'
```

---

## 📡 API 文档

### POST /api/v1/tasks

提交新任务

**请求体：**

```json
{
  "task": "string",           // 任务描述
  "tools": ["string"],        // 使用的技能列表
  "apiKey": "string"         // API Key
}
```

**响应：**

```json
{
  "taskId": "uuid",
  "status": "pending",
  "message": "Task submitted successfully",
  "pollUrl": "/api/v1/tasks/{id}/poll",
  "skills": ["web-search", "code-generator", ...]
}
```

---

### GET /api/v1/tasks/:taskId/poll

**轮询获取任务进度**

**响应：**

```json
{
  "taskId": "uuid",
  "status": "completed",
  "progress": 100,
  "step": "completed",
  "message": "Task completed successfully",
  "result": "# Generated Report\n...",
  "duration": 1500
}
```

---

### GET /api/v1/skills

**获取可用技能列表**

**响应：**

```json
{
  "skills": [
    "web-search",
    "code-generator",
    "report-generator",
    "github-publisher"
  ],
  "count": 4
}
```

---

### GET /metrics

**Prometheus 格式指标**

```bash
curl http://localhost:3000/metrics
```

**指标：**

```
agent_skills_total 4
agent_tasks_total 10
agent_tasks_completed 8
agent_tasks_failed 2
```

---

## 🧠 Skills 详细说明

### 1. Web Search (`web-search`)

**功能**：搜索互联网获取信息

**使用场景**：
- 研究特定主题
- 获取最新资讯
- 事实核查

**示例**：

```json
{
  "task": "Search for latest developments in quantum computing",
  "tools": ["web-search"]
}
```

---

### 2. Code Generator (`code-generator`)

**功能**：根据需求生成代码

**支持的项目类型**：

| 类型 | 标识 | 示例 |
|------|------|------|
| HTML/CSS/JS | html | 落地页、网站 |
| React | react | 组件、Next.js |
| API | api | Node.js/Python 后端 |
| 脚本 | script | Bash/Python 脚本 |

**示例**：

```json
{
  "task": "Create a React todo app with TypeScript",
  "tools": ["code-generator"]
}
```

**生成的文件结构**：

```
project-name/
├── index.html
├── styles.css
├── script.js
└── README.md
```

---

### 3. Report Generator (`report-generator`)

**功能**：生成综合报告

**支持的报告类型**：

| 类型 | 标识 | 示例 |
|------|------|------|
| 旅行 | travel | 行程规划、预算 |
| 技术 | technical | API 文档、技术方案 |
| 研究 | research | 研究报告、分析 |
| 摘要 | summary | 执行摘要 |

**示例**：

```json
{
  "task": "Create a 7-day Japan travel itinerary with budget breakdown",
  "tools": ["report-generator"]
}
```

**报告结构**：

```
# Trip Overview
# Day-by-Day Itinerary
# Accommodations
# Top Activities
# Budget Breakdown
# Travel Tips
```

---

### 4. GitHub Publisher (`github-publisher`)

**功能**：发布代码到 GitHub

**支持的操作**：

| 操作 | 说明 |
|------|------|
| create-repo | 创建新仓库 |
| push-code | 推送代码 |
| create-pr | 创建 Pull Request |
| release | 发布版本 |

**示例**：

```json
{
  "task": "Create a repo ai-project and push the generated code",
  "tools": ["github-publisher"],
  "apiKey": "ghp_xxx"
}
```

---

## 📊 进度状态

### 状态流转

```
pending → running → completed/failed
          ↓
    progress: 0-100
    step: analyzing → searching → processing → generating → completing
```

### 详细进度

| Progress | Step | 说明 |
|----------|------|------|
| 10% | analyzing | 分析任务需求 |
| 25% | tool_1 | 执行第一个技能 |
| 50% | tool_2 | 执行第二个技能 |
| 75% | processing | 处理结果 |
| 100% | completed | 完成 |

---

## 🐳 Docker 部署

### 资源要求

| 配置 | 最低 | 推荐 |
|------|------|------|
| 内存 | 512MB | 1GB |
| CPU | 1 vCPU | 2 vCPU |
| 磁盘 | 1GB | 5GB |

### 启动服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### Docker Compose 配置

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
```

---

## 🔒 安全建议

1. **API Key 管理**
   - 使用复杂 API Key
   - 定期轮换
   - 监控使用量

2. **容器隔离**
   - Docker 容器隔离危险代码
   - 内存/CPU 限制

3. **文件安全**
   - 任务完成后清理文件
   - 限制文件大小

---

## 🧪 测试

```bash
# 运行测试
npm test

# 测试单个文件
npm test -- tests/api.test.js
```

---

## 📈 监控

### 健康检查

```bash
curl http://localhost:3000/health
```

**响应：**

```json
{
  "status": "healthy",
  "mode": "memory",
  "skills": 4,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 指标端点

```bash
curl http://localhost:3000/metrics
```

---

## ❓ 常见问题

### Q: Docker 容器启动失败？

A: 检查 Docker daemon 是否运行：
```bash
docker ps
```

### Q: 内存不足？

A: 减少 `maxConcurrentTasks` 为 1

### Q: 任务超时？

A: 增加 `taskTimeout` 配置或检查 API 响应速度

### Q: 如何查看日志？

```bash
# Docker 模式
docker-compose logs -f

# 本地模式
npm run dev
```

---

## 📝 更新日志

### v1.0.0 (2024-01-01)
- ✨ 初始版本
- ✅ API 服务
- ✅ 4 个 Skills
- ✅ 进度追踪
- ✅ Docker 部署
- ✅ Redis 支持

---

## 🔗 相关文档

- 主文档：`/root/.openclaw/workspace/MEMORY.md`
- GitHub: https://github.com/chinasilva/agent-sandbox
