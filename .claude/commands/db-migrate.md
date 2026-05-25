---
description: 运行数据库迁移并重新生成 Prisma 客户端，然后执行 seed
---

在 schema 变更或权限变更后运行此命令以更新数据库。

```bash
/skill db-migrate
```

或手动执行:

```bash
cd infra/database
npx prisma migrate dev
npx prisma generate
npm run seed
```
