---
description: 同步工作区（生成 Prisma 客户端并构建共享包）
---

在 schema 变更后运行此命令以同步类型。

```bash
/skill sync
```

或手动执行:

```bash
cd infra/database && npx prisma generate
cd ../shared && pnpm build
```
