---
description: 启动后端 API 服务（NestJS + tRPC）
---

启动后端开发服务器，使用 Monitor 工具实时监控日志。

**启动前检查端口占用：**

先检查 3000 端口是否有进程占用，如果有则先停止：

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

启动命令：

```typescript
Monitor({
  command: 'cd apps/api && pnpm dev',
  description: '后端 API 服务监控（NestJS + tRPC）',
  persistent: true,
  timeout_ms: 3600000,
});
```

服务地址：

- tRPC: http://localhost:3000/trpc
- Swagger 文档: http://localhost:3000/api/docs
- REST API: http://localhost:3000/api

停止服务：
使用 `/tasks` 命令查看运行中的任务 ID，然后使用 TaskStop 工具停止服务。
