# Vercel + GitHub 自动部署配置指南

## 当前状态

✅ Vercel 项目已创建
❌ GitHub 集成未配置
⏳ 需要手动完成连接

---

## 快速配置（2 分钟）

### 步骤 1: 访问 Vercel 项目设置

打开浏览器访问：
```
https://vercel.com/bravesilvas-projects/agent-sandbox/settings
```

### 步骤 2: 连接 GitHub

在项目设置页面找到 **"Git Integration"** 部分：

1. 点击 **"Connect Git Repository"**
2. 在弹出窗口中搜索: `chinasilva/agent-sandbox`
3. 选择该仓库
4. 点击 **"Connect"**

### 步骤 3: 启用自动部署

连接成功后，配置:

- ✅ **Auto Deploy on Push**: 启用
- ✅ **Preview Deployments**: 启用  
- ⬜ **Production Deployments**: 可选（启用后 main 分支自动部署到生产环境）

### 步骤 4: 保存配置

点击 **"Save"** 保存设置。

---

## 验证配置成功

### 方法 1: 检查项目设置

访问: https://vercel.com/bravesilvas-projects/agent-sandbox/settings

应该看到:
- ✅ Git Integration 显示已连接
- ✅ 显示仓库名称: `chinasilva/agent-sandbox`

### 方法 2: 测试自动部署

```bash
cd /root/.openclaw/workspace/aicode/agent-sandbox

# 做个小的更改
echo "# Test" >> README.md

# 推送到 GitHub
git add README.md
git commit -m "test: Vercel auto deploy"
git push origin main
```

5 秒后访问: https://vercel.com/bravesilvas-projects/agent-sandbox/deployments

应该看到新的部署正在运行。

---

## 部署后效果

```
git push origin main
        ↓
    Vercel 自动部署 (~30秒)
        ↓
   ✅ 预览链接生成
   ✅ 生产环境更新 (如启用)
```

---

## 当前项目信息

| 配置项 | 值 |
|--------|-----|
| Vercel 项目 | agent-sandbox |
| 项目 ID | prj_TXdfFsq1sphJRctcY6tNIfkS4AEa |
| 域名 | agent-sandbox-bravesilvas-projects.vercel.app |
| GitHub 仓库 | `chinasilva/agent-sandbox` (待连接) |

---

## 故障排除

### 问题 1: 找不到仓库

**原因**: Vercel GitHub App 未安装或权限不足

**解决**:
1. 访问 https://vercel.com/account/integrations
2. 找到 **GitHub** 
3. 点击 **"Configure"**
4. 确保已安装 Vercel GitHub App
5. 确保授权了 `chinasilva/agent-sandbox` 仓库

### 问题 2: 私有仓库

**原因**: 仓库是私有的

**解决**:
1. 在 GitHub 仓库设置中
2. 确保 Vercel GitHub App 有访问权限
3. 或将仓库改为公开

### 问题 3: 部署不触发

**解决**:
1. 确认 GitHub 连接成功
2. 检查分支名称是否为 `main`
3. 在项目设置中确认 **"Auto Deploy"** 已启用

---

## 完成后的效果

✅ `git push` 自动触发部署
✅ 每个 PR 生成预览链接
✅ 部署状态显示在 GitHub PR 中
✅ 无需手动操作

---

## 需要帮助？

如果配置过程中遇到问题，请告诉我具体的错误信息，我可以帮你解决！
