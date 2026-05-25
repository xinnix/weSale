---
name: init-project
description: 交互式初始化新项目 — 重命名包名、数据库、环境变量，从脚手架生成可开发的新项目。
---

# /init-project — 项目初始化

## Overview

将 OpenCode Scaffold 初始化为一个全新的项目。重命名所有 `@opencode` 引用、数据库名称等。

## Instructions

### Step 1: 收集信息

询问用户以下信息：

1. **项目名称** (如 `my-app`)
2. **包名前缀** (如 `@mycompany`，默认使用项目名称)
3. **数据库名称** (如 `my_app_db`)

### Step 2: 替换包名

搜索替换以下文件中的 `@opencode` → `@<new-prefix>`：

```bash
# 搜索所有引用
grep -r "@opencode" --include="*.json" --include="*.ts" --include="*.tsx" -l

# 替换（bash 示例）
find . -name "*.json" -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/@opencode\/shared/@newproject\/shared/g'
find . -name "*.json" -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/@opencode\/api/@newproject\/api/g'
find . -name "*.json" -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/@opencode\/admin/@newproject\/admin/g'
find . -name "*.json" -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/@opencode\/database/@newproject\/database/g'
```

### Step 3: 更新数据库名称

编辑 `.env` 文件：

- `DATABASE_URL` 中的数据库名称 → 新名称

编辑 `docker-compose.local.yml`：

- `POSTGRES_DB` → 新名称

### Step 4: 更新 CLAUDE.md

替换 CLAUDE.md 中的项目名称引用从 "OpenCode" → 新项目名称。

### Step 5: 重新安装和构建

```bash
pnpm install
pnpm sync        # 或 /sync — Prisma Generate + Build Shared
pnpm build       # 或 /build-all
```

### Step 6: 初始化数据库

```bash
# 创建并启动数据库
docker compose -f docker-compose.local.yml up -d

# 运行迁移
/db-migrate
```

### Step 7: 验证

```bash
/start-backend
/start-frontend
```

确认登录、CRUD 等功能正常工作。

## 注意事项

- 此操作不可逆，建议先在 Git 中提交或备份
- `infra/shared` 构建后的 `.d.ts` 会随 `pnpm build` 重新生成，无需手动清理
- 小程序的 `appId` 等微信配置需要在新项目中单独申请
