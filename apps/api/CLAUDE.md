# Backend API (NestJS + tRPC)

## 架构

- **tRPC Router** — Admin 端强类型 API，所有 CRUD 操作
- **REST Controller** — 外部/小程序 API，标准 HTTP 端点
- **Service** — 业务逻辑层，应继承 BaseService

## 关键模式

### Service 必须继承 BaseService

```typescript
export class XxxService extends BaseService<Xxx> {
  constructor(prisma: PrismaService) {
    super(prisma, 'xxx');
  }
}
```

### Router 优先使用 createCrudRouter

```typescript
export const xxxRouter = createCrudRouter({
  model: 'xxx',
  service: XxxService,
  schemas: { createInput: CreateXxxSchema, updateInput: UpdateXxxSchema },
  // 可选：searchFields, filterableFields, auth 配置
});
```

### 自定义 procedure 用 createCrudRouterWithCustom

```typescript
export const xxxRouter = createCrudRouterWithCustom(
  { /* CRUD 配置 */ },
  (t) => ({
    customAction: protectedProcedure.input(...).mutation(...),
  })
);
```

## 目录结构

```
src/
├── modules/<name>/       # 业务模块
│   ├── <name>.service.ts
│   ├── <name>.router.ts
│   └── <name>.controller.ts  # 可选，REST 端点
├── trpc/
│   ├── app.router.ts     # 路由注册
│   └── trpc.helper.ts    # createCrudRouter 工厂
├── common/
│   └── base.service.ts   # CRUD 基类
└── shared/services/      # 共享服务（文件存储等）
```

## 注意事项

- tRPC 路由在 `app.router.ts` 中注册
- REST Controller 需要 `@Controller()` 装饰器
- userId 注入：BaseService 自动处理 `createdById`/`updatedById`
- 数据隔离：User 端查询必须加 `where: { userId }`
