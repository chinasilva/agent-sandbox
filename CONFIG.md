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

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Sandbox                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   用户浏览器                                              │
│       │                                                  │
│       ▼                                                  │
│   API Server (Hono + Node.js)                           │
│   ├── POST /api/v1/tasks   → 提交任务                    │
│   ├── GET /api/v1/tasks/:id → 查询状态                   │
│   ├── GET /api/v1/containers → 容器列表                  │
│   └── GET /metrics → Prometheus 指标                    │
│       │                                                  │
│       ▼                                                  │
│   Redis Queue                                            │
│   ├── tasks (待执行任务队列)                             │
│   └── task:{id} (任务状态)                              │
│       │                                                  │
│       ▼                                                  │
│   Executor (Docker 容器池)                               │
│   └── 2 个预热容器（可配置）                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| API 框架 | Hono | 轻量 Web 框架 |
| 消息队列 | Redis + BullMQ | 任务调度 |
| 容器化 | Docker | 任务隔离执行 |
| 运行环境 | Node.js 20+ | 服务端 |
| 配置文件 | JSON | 易于修改 |

---

## 🔧 配置项说明

### 默认配置 (`config/default.json`)

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "docker": {
    "maxContainers": 2,      // 容器池大小（2GB 服务器推荐 2）
    "memoryLimit": "256m",    // 单容器内存限制
    "cpuLimit": "0.5"         // 单容器 CPU 限制
  },
  "agent": {
    "maxConcurrentTasks": 2,  // 最大并发任务数
    "taskTimeout": 300        // 任务超时（秒）
  }
}
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

### 3. 构建并启动

```bash
# 构建 Docker 镜像
npm run build:image

# 启动所有服务
npm run up

# 查看日志
npm run logs
```

### 4. 测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# 提交任务
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task": "规划日本7天旅游行程",
    "tools": ["web_search", "llm"],
    "apiKey": "test-key-123"
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
  "tools": ["string"],        // 使用的工具列表
  "apiKey": "string",         // API Key
  "webhookUrl": "string"      // 可选：进度回调 URL
}
```

**响应：**
```json
{
  "taskId": "uuid",
  "status": "pending",
  "message": "Task queued successfully",
  "pollUrl": "/api/v1/tasks/{id}/poll",
  "wsUrl": "/api/v1/tasks/{id}/sse"
}
```

---

### GET /api/v1/tasks/:taskId/poll

**轮询获取任务进度**（推荐）

**响应：**
```json
{
  "taskId": "uuid",
  "status": "running",
  "progress": 40,
  "step": "searching",
  "message": "Searching for relevant information",
  "createdAt": "2026-02-05T15:00:00Z",
  "startedAt": "2026-02-05T15:00:01Z"
}
```

**状态流转：**
```
queued → running → completed/failed
          ↓
    progress: 0-100
    step: analyzing → searching → processing → completing
```

---

### GET /api/v1/tasks/:taskId/sse

**Server-Sent Events 实时进度**（推荐用于实时 UI）

```javascript
// 前端示例
const eventSource = new EventSource('/api/v1/tasks/{taskId}/sse');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data.progress, data.step, data.message);
  
  if (data.status === 'completed') {
    eventSource.close();
    console.log('Result:', data.result);
  }
};
```

**事件格式：**
```json
{
  "type": "progress",
  "taskId": "uuid",
  "status": "running",
  "progress": 50,
  "step": "searching",
  "message": "Searching for relevant information",
  "timestamp": "2026-02-05T15:00:05Z"
}
```

---

### Webhook 回调（可选）

提交任务时设置 `webhookUrl`，任务进度会 POST 到该 URL：

```json
// POST {webhookUrl}
{
  "taskId": "uuid",
  "status": "running",
  "progress": 60,
  "step": "processing",
  "message": "Processing with AI",
  "timestamp": "2026-02-05T15:00:10Z"
}
```

---

### 📊 进度状态示例

| Progress | Step | Message |
|----------|------|---------|
| 10% | starting | Task started |
| 30% | initializing | Preparing environment |
| 40% | searching | Searching web... |
| 60% | processing | Using AI... |
| 90% | finalizing | Saving results |
| 100% | completed | Task completed |

### GET /api/v1/tasks/:taskId

查询任务状态

**响应：**
```json
{
  "taskId": "uuid",
  "status": "completed",  // pending | running | completed | failed
  "result": {
    "output": "# Markdown 结果..."
  },
  "createdAt": "2026-02-05T15:00:00Z"
}
```

### GET /api/v1/containers

查看容器池状态

### GET /metrics

Prometheus 格式指标

---

## 🐳 Docker 部署

### 资源要求

| 配置 | 最低 | 推荐 |
|------|------|------|
| 内存 | 2GB | 4GB |
| CPU | 1 vCPU | 2 vCPU |
| 磁盘 | 10GB | 20GB |

### 单服务器部署

```bash
# 构建
docker-compose build

# 启动
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 服务器资源紧张？

2GB 服务器请使用优化配置：

```yaml
# docker-compose.yml 优化
services:
  api:
    deploy:
      resources:
        limits:
          memory: 256M   # API 限制 256MB
          cpus: '0.25'
  
  executor:
    deploy:
      resources:
        limits:
          memory: 128M   # 执行器限制 128MB
          cpus: '0.25'
  
  redis:
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
```

---

## 🔒 安全建议

1. **API Key 管理**
   - 生产环境使用复杂 API Key
   - 定期轮换 Key
   - 监控使用量

2. **容器隔离**
   - 使用 `network: none` 限制网络
   - 设置内存/CPU 限制
   - 启用 `AutoRemove`

3. **文件安全**
   - 不在容器中存储敏感信息
   - 使用只读配置挂载
   - 任务完成后清理文件

---

## 📊 监控指标

| 指标 | 说明 |
|------|------|
| `agent_containers_total` | 总容器数 |
| `agent_containers_active` | 运行中容器数 |
| `agent_tasks_pending` | 待处理任务数 |
| `agent_tasks_completed` | 已完成任务数 |
| `agent_tasks_failed` | 失败任务数 |

---

## 🧪 测试

```bash
# 运行测试（需要先启动服务）
npm test
```

---

## 📝 更新日志

### v1.0.0 (2026-02-05)
- ✨ 初始版本
- ✅ API 服务
- ✅ Docker 容器池
- ✅ Redis 任务队列
- ✅ 基础 Agent 执行器

---

## ❓ 常见问题

### Q: 容器启动失败？
A: 检查 Docker daemon 是否运行：`docker ps`

### Q: 内存不足？
A: 减少 `maxContainers` 为 1，或降低内存限制

### Q: 任务超时？
A: 增加 `taskTimeout` 配置，或检查 LLM API 响应速度

### Q: 如何查看日志？
A: `npm run logs` 或 `docker-compose logs -f`

---

## 🔗 相关文档

- 主文档：`/root/.openclaw/workspace/MEMORY.md`
- 技术栈：`package.json`
