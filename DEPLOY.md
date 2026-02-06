# Vercel Deployment for Agent Sandbox

## Quick Deploy

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd /root/.openclaw/workspace/aicode/agent-sandbox
vercel --prod
```

### Option 2: Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository: `https://github.com/chinasilva/agent-sandbox`
3. Configure:
   - Framework Preset: **Other**
   - Build Command: `npm install`
   - Output Directory: `src/www`
4. Click **Deploy**

## Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `JWT_SECRET` | Your secret key (use `openssl rand -hex 32`) | Yes |
| `NODE_ENV` | `production` | No |

## Current Deployment Status

**Preview URL (需要认证):**
```
https://agent-sandbox-34gqodb7c-bravesilvas-projects.vercel.app
```

**Production URL (首次部署失败，需要重新部署):**
```
https://agent-sandbox-d5hbztinc-bravesilvas-projects.vercel.app
```

## GitHub 自动部署

1. Push 代码到 GitHub
2. Vercel 会自动触发部署
3. 查看状态: https://vercel.com/bravesilvas-projects/agent-sandbox

## 本地开发

```bash
cd /root/.openclaw/workspace/aicode/agent-sandbox
npm start
# 访问 http://localhost:3000
```

## API 端点

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/skills` | GET | List skills |
| `/api/v1/auth/register` | POST | Register user |
| `/api/v1/auth/login` | POST | Login |
| `/api/v1/tasks` | POST | Submit task |
| `/metrics` | GET | Prometheus metrics |

## 注意事项

1. **SQLite 文件存储**: Vercel Serverless 是无状态的，数据库文件不会持久化
2. **完整功能**: 需要自托管服务器或使用数据库服务（如 Turso, PlanetScale）
3. **API Key**: 在 Vercel Dashboard 中配置环境变量

## 推荐的外部用户部署方案

对于需要外部用户访问的完整功能，推荐：

1. **Vercel** (当前): API 演示，无状态
2. **Railway/Render/Supabase**: 有状态应用，支持 SQLite/PostgreSQL
3. **DigitalOcean/AWS**: 完全控制

需要我帮你部署到其他平台吗？
