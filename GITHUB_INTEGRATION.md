# Vercel + GitHub 自动部署配置

## 当前状态

✅ Vercel 项目已创建: `agent-sandbox`
❌ 尚未连接到 GitHub 自动部署

## 手动配置步骤（最简单）

### 方法 1: Vercel Dashboard（推荐）

1. 访问: https://vercel.com/bravesilvas-projects/agent-sandbox/settings

2. 找到 **"Git Integration"** 部分

3. 点击 **"Connect Git Repository"**

4. 选择你的仓库: `chinasilva/agent-sandbox`

5. 配置:
   - ✅ **Auto Deploy**: 启用
   - ✅ **Preview Deployments**: 启用
   - ❌ **Production Deployments**: 可选

6. 保存设置

### 方法 2: 通过项目重新创建

```bash
# 1. 删除本地 .vercel 目录
cd /root/.openclaw/workspace/aicode/agent-sandbox
rm -rf .vercel

# 2. 重新链接并选择 GitHub
vercel --prod
# 在提示时选择 "Connect to GitHub"
```

## 配置后效果

- ✅ `git push origin main` → 自动触发 Vercel 部署
- ✅ 预览部署: 每个 PR 独立 URL
- ✅ 生产部署: `main` 分支自动部署到生产环境

## 验证是否成功

部署后访问:
- **生产环境**: https://agent-sandbox-bravesilvas-projects.vercel.app
- **项目设置**: https://vercel.com/bravesilvas-projects/agent-sandbox/settings

检查 **"Git Integration"** 是否显示已连接的仓库。

## 当前部署信息

| 项目 | 值 |
|------|-----|
| 项目 ID | prj_TXdfFsq1sphJRctcY6tNIfkS4AEa |
| 项目名称 | agent-sandbox |
| 所有者 | bravesilvas-projects |
| GitHub 仓库 | `chinasilva/agent-sandbox` (未链接) |
| 最后部署 | 932799b - "feat: Switch to sql.js" |

## 下一步

请访问 https://vercel.com/bravesilvas-projects/agent-sandbox/settings

点击 **"Connect Git Repository"** → 选择 `chinasilva/agent-sandbox` → 完成！
