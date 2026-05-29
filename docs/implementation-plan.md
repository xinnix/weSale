# AI 销售 Agent 系统 — 分阶段实施计划 v5.1

## Context

将 OpenCode Scaffold 扩展为 AI 销售 Agent 系统。核心流程：访客访问落地页 → 微信客服对话 → AI 自动对话 → 推荐商品 → 发送支付链接 → 付款 → 订单生成 → 商家履约。

**架构升级（v5.0）**：可配置商品体系。商家后台录入商品，AI 推荐对应商品，成交生成订单（含履约状态），订单可导出。

**实施策略（v5.1）**：**从外到内，先通管道再塞智能**。先部署落地页获取真实反馈，再打通微信客服让人工能对话，最后逐步接入 AI 和支付。每一步都可独立上线验证。

---

## 实施总览：四轮递进

```
┌─────────────────────────────────────────────────────┐
│ Round 1: 上线获取反馈                                │
│ 落地页 → 微信客服入口 → 人工在企微后台回复           │
│ 交付物：可访问的落地页，访客能发起客服对话             │
├─────────────────────────────────────────────────────┤
│ Round 2: 管理后台接管对话                            │
│ 消息归档 → 后台看对话 → 后台人工回复 → 访客档案       │
│ 交付物：运营不用切企微，在自家后台看/回所有对话        │
├─────────────────────────────────────────────────────┤
│ Round 3: AI 自动对话 + 商品体系                      │
│ 商品管理 → AI 引擎 → 自动回复 → 模拟支付卡片         │
│ 交付物：AI 7×24 自动销售，人工仅处理转接              │
├─────────────────────────────────────────────────────┤
│ Round 4: 支付闭环 + 订单履约                         │
│ 真实支付 → 订单管理 → 导出 → 履约 → 仪表盘           │
│ 交付物：全自动销售闭环，从对话到付款到履约             │
└─────────────────────────────────────────────────────┘
```

---

## 关键设计决策

| 决策       | 选择                             | 原因                                        |
| ---------- | -------------------------------- | ------------------------------------------- |
| 主键类型   | BigInt @default(autoincrement()) | PRD 要求，大量数据更高效                    |
| 字段命名   | snake_case + @@map               | PRD 要求，新模型统一风格                    |
| 内容加密   | AES-256-GCM                      | 比 CBC 更安全，带认证标签防篡改             |
| AI API     | DeepSeek (OpenAI 兼容)           | blocking 模式获取完整 JSON                  |
| 商品体系   | Product 模型 + 动态注入          | AI 每轮查询上架商品，注入 {product_catalog} |
| 订单模型   | Order 替代 PaymentRecord         | 含履约状态、客户信息、关联商品              |
| 实时推送   | SSE                              | 单向推送，NestJS 原生支持                   |
| 定时任务   | BullMQ                           | 基于 Redis 持久化，比 @Cron 更可靠          |
| 落地页部署 | Docker + 国内服务器              | 国内访问延迟低，微信生态要求域名备案        |

---

# Round 1: 上线获取反馈 [3-5天]

> 目标：落地页上线，访客能点击客服按钮发起对话，人工在企微后台回复。
> 这轮结束后就能拿到真实流量和对话数据。

## Phase 1.1: 数据模型基础 [1天]

**目标**: 建立 Contact + ConversationSession + ConversationMessage 最小模型，供后续消息归档使用。

### 任务

| #     | 任务                          | 文件                        |
| ----- | ----------------------------- | --------------------------- |
| 1.1.1 | 新增核心枚举                  | `schema.prisma`             |
| 1.1.2 | 新增 Contact 模型             | 同上                        |
| 1.1.3 | 新增 ConversationSession 模型 | 同上                        |
| 1.1.4 | 新增 ConversationMessage 模型 | 同上                        |
| 1.1.5 | 新增 Zod schema               | `infra/shared/src/index.ts` |
| 1.1.6 | 执行 `/db-migrate` + `/sync`  | CLI                         |

### 最小枚举集

```prisma
enum IntentLevel   { UNKNOWN LOW MEDIUM HIGH CLOSING }
enum ContactStatus { ACTIVE CONVERTED ESCALATED ARCHIVED }
enum SessionState  { GREETING NEEDS_DISCOVERY PRODUCT_MATCH OBJECTION_HANDLING CLOSING CONVERTED ESCALATED TIMED_OUT }
enum MessageRole   { user assistant }
enum MessageType   { TEXT IMAGE LINK_CARD SYSTEM_NOTE }
```

### 验证方案

**V1 — 编译通过**

```bash
pnpm --filter @opencode/shared build   # shared 包构建成功
pnpm --filter @opencode/api type-check  # 后端类型检查通过
```

**V2 — 数据库迁移成功**

```bash
cd infra/database && npx prisma migrate dev --name add_core_models
# 输出包含: Applied migration xxx_add_core_models
```

**V3 — 表结构正确**

```bash
npx prisma studio  # 打开 Prisma Studio
```

- 在 Prisma Studio 中确认 `contacts`、`conversation_sessions`、`conversation_messages` 三张表存在
- 确认 5 个枚举存在: IntentLevel, ContactStatus, SessionState, MessageRole, MessageType

**V4 — Prisma Client 可查询**

```bash
cd apps/api && npx ts-node -e "
const { PrismaClient } = require('../infra/database/prisma/generated');
const p = new PrismaClient();
p.contact.count().then(c => console.log('contacts:', c)).finally(() => p.\$disconnect());
"
# 输出: contacts: 0
```

> **Phase 1.1 通过条件**: V1 + V2 + V3 + V4 全部成功 → 进入 Phase 1.2

---

## Phase 1.2: 微信客服接入 [1-2天]

**目标**: 微信客服 Webhook 接入，消息接收 + 发送能力，JSSDK 签名。

### 任务

| #     | 任务                                    | 文件                                                           |
| ----- | --------------------------------------- | -------------------------------------------------------------- |
| 1.2.1 | WechatKfCryptoService                   | `apps/api/src/modules/wechat-kf/services/kf-crypto.service.ts` |
| 1.2.2 | WechatKfApiService                      | `apps/api/src/modules/wechat-kf/services/kf-api.service.ts`    |
| 1.2.3 | WechatKfService (高层封装)              | `apps/api/src/modules/wechat-kf/services/kf.service.ts`        |
| 1.2.4 | Webhook Controller (GET验证 + POST接收) | `apps/api/src/modules/wechat-kf/rest/kf.controller.ts`         |
| 1.2.5 | WechatKf Module + 注册                  | `apps/api/src/modules/wechat-kf/module.ts`                     |
| 1.2.6 | JSSDK 签名端点                          | 同 1.2.4                                                       |

### 复用说明

- `WecomCryptoService` 的 AES-256-CBC + XML 解析可参考
- `WecomApiService` 已有 `sendKfMessage` / `syncKfMessage`，优先复用
- access_token 缓存复用 RedisService

### 验证方案

**V1 — 后端启动无报错**

```bash
pnpm --filter @opencode/api dev
# 日志输出: Nest application successfully started
# 无 WechatKfModule 相关报错
```

**V2 — Webhook 验证端点可访问**

```bash
curl "http://localhost:3000/api/webhook/wechat-kf?msg_signature=test&timestamp=123&nonce=abc&echostr=hello"
# 返回 echostr 明文（微信回调验证逻辑）
```

**V3 — JSSDK 签名端点可访问**

```bash
curl "http://localhost:3000/api/jssdk/config?url=https://example.com"
# 返回 JSON: { appId, timestamp, nonceStr, signature }
```

**V4 — 微信客服消息发送（需微信测试环境）**

- 在企微后台配置客服账号回调 URL 指向 `https://your-domain/api/webhook/wechat-kf`
- 用测试微信号向客服发一条文字消息
- 检查后端日志：出现消息解密成功日志，包含 openId 和 content
- 在企微后台手动回复，确认用户收到

**V5 — 类型检查通过**

```bash
pnpm --filter @opencode/api type-check
```

> **Phase 1.2 通过条件**: V1 + V2 + V3 + V5 成功 → 进入 Phase 1.3
> **V4 需微信测试环境**：若无测试环境，可先跳过 V4，在 Phase 1.3 落地页部署后一并验证

---

## Phase 1.3: 落地页 [2-3天]

**目标**: Next.js 营销落地页上线，访客能点击客服按钮发起对话。

### 任务

| #     | 任务                    | 文件                                                    |
| ----- | ----------------------- | ------------------------------------------------------- |
| 1.3.1 | Next.js 应用初始化      | `apps/landing/`                                         |
| 1.3.2 | HeroSection             | `apps/landing/app/components/HeroSection.tsx`           |
| 1.3.3 | SocialProofSection      | 同上                                                    |
| 1.3.4 | FeaturesSection         | 同上                                                    |
| 1.3.5 | PricingSection          | 同上                                                    |
| 1.3.6 | FloatingCTA             | 同上                                                    |
| 1.3.7 | UTM 采集 + 微信客服入口 | `apps/landing/app/hooks/useUtm.ts`, `WechatKfEntry.tsx` |
| 1.3.8 | SEO + 响应式适配        | `apps/landing/app/layout.tsx`                           |
| 1.3.9 | Dockerfile + 部署配置   | `apps/landing/Dockerfile`, `docker-compose.yml`         |

### 验证方案

**V1 — 落地页本地启动**

```bash
cd apps/landing && pnpm dev
# http://localhost:3001 可访问，页面渲染正常
```

**V2 — Lighthouse 评分**

```bash
npx lighthouse http://localhost:3001 --output=json --chrome-flags="--headless" | jq '.categories.performance.score'
# Performance > 0.9
```

**V3 — 响应式适配**

- Chrome DevTools 切换到 iPhone SE (375px)：页面不溢出，文字可读
- 切换到 iPad (768px)：布局自适应
- 切换到 Desktop (1440px)：布局正常

**V4 — 微信客服入口（微信浏览器内）**

- 用微信打开落地页 URL
- 点击 CTA 按钮 → 弹出微信客服对话框
- 发送一条消息 → 企微后台收到

**V5 — 非微信浏览器**

- Chrome 打开落地页 → 点击 CTA → 弹窗显示二维码 + "用微信扫码体验"

**V6 — UTM 参数追踪**

- 访问 `https://landing-url/?utm_source=google&utm_campaign=spring_sale`
- localStorage 中存储 utm_source=google, utm_campaign=spring_sale
- 点击客服按钮 → 链接 URL 包含 utm 参数

**V7 — Docker 构建与部署（国内服务器）**

Dockerfile 要点（国内镜像源优化）：

```dockerfile
# apps/landing/Dockerfile
FROM node:20-alpine AS builder
# 使用国内 npm 镜像加速依赖安装
RUN npm config set registry https://registry.npmmirror.com
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/landing/ ./apps/landing/
RUN pnpm --filter landing build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public
EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/landing/server.js"]
```

构建与部署：

```bash
# 本地构建镜像
docker build -f apps/landing/Dockerfile -t wesale-landing:latest .

# 本地验证
docker run -p 3001:3001 wesale-landing:latest
curl -I http://localhost:3001  # 返回 200

# 推送到国内镜像仓库
docker tag wesale-landing:latest registry.cn-hangzhou.aliyuncs.com/wesale/landing:latest
docker push registry.cn-hangzhou.aliyuncs.com/wesale/landing:latest

# 在国内服务器拉取并运行
ssh your-server "docker pull registry.cn-hangzhou.aliyuncs.com/wesale/landing:latest && docker compose up -d landing"
```

docker-compose.yml 片段：

```yaml
landing:
  image: registry.cn-hangzhou.aliyuncs.com/wesale/landing:latest
  ports:
    - '3001:3001'
  environment:
    - NEXT_PUBLIC_KF_URL=https://work.weixin.qq.com/kfid/KF_ID
    - NEXT_PUBLIC_API_URL=https://api.your-domain.com
  restart: unless-stopped
```

**V8 — 国内访问验证**

```bash
# 从国内服务器验证
curl -I https://your-landing-domain  # 返回 200
# 从国内手机浏览器验证
# 页面加载 < 3s（国内 CDN/服务器直连）
```

> **Round 1 通过条件**: V1 + V2 + V3 + V7 + V8 成功 → 进入 Round 2
> **V4 + V5 + V6 需真实微信环境**：部署后用手机验证
> **Round 1 里程碑：落地页上线，开始获取真实流量反馈**

### Round 1 交付物

- 可访问的落地页
- 访客点击客服按钮能发起对话
- 人工在企微后台手动回复
- **可获取真实流量和对话反馈**

---

# Round 2: 管理后台接管对话 [5-7天]

> 目标：消息自动归档，运营在自家后台看所有对话、直接回复，不用切企微。
> 建立访客档案，人工接管队列。

## Phase 2.1: 加密服务与访客档案 [2天]

**目标**: AES-256-GCM 加密/解密 + Contact CRUD。

### 任务

| #     | 任务                                 | 文件                                                          |
| ----- | ------------------------------------ | ------------------------------------------------------------- |
| 2.1.1 | CryptoService (AES-256-GCM)          | `apps/api/src/shared/services/crypto.service.ts`              |
| 2.1.2 | ContactService (extends BaseService) | `apps/api/src/modules/contact/services/contact.service.ts`    |
| 2.1.3 | Contact tRPC Router                  | `apps/api/src/modules/contact/trpc/contact.router.ts`         |
| 2.1.4 | Contact Module + 注册                | `apps/api/src/modules/contact/module.ts`                      |
| 2.1.5 | Contact 前端列表页                   | `apps/admin/src/modules/contacts/pages/ContactListPage.tsx`   |
| 2.1.6 | Contact 前端详情页                   | `apps/admin/src/modules/contacts/pages/ContactDetailPage.tsx` |

### 核心方法

- `findOrCreateByOpenId(openId, utmParams?)` — 原子 upsert
- `markConverted(id, paidAmountFen)` — 事务更新
- `encryptField()` / `decryptField()` — 调用 CryptoService

### 验证方案

**V1 — CryptoService 单元测试**

```bash
cd apps/api && npx jest crypto.service.spec.ts
# 测试用例:
# - encrypt → decrypt 往返还原原文
# - 篡改密文后 decrypt 抛出 AuthenticationError
# - 空字符串 encrypt/decrypt 正常
# - 不同密钥 decrypt 失败
```

**V2 — ContactService 集成测试**

```bash
npx jest contact.service.spec.ts
# 测试用例:
# - findOrCreateByOpenId("o123") → 创建新 Contact
# - findOrCreateByOpenId("o123") 再次调用 → 返回同一 Contact（幂等）
# - findOrCreateByOpenId("o123", {utmSource:"google"}) → 首次写入 utm
# - findOrCreateByOpenId("o123", {utmSource:"baidu"}) → 不覆盖已有 utm
# - markConverted → status=CONVERTED, convertedAt 有值
```

**V3 — tRPC Contact Router 可调用**

```bash
# 启动后端后，用 tRPC client 测试
npx ts-node -e "
const c = createTRPCProxyClient({url:'http://localhost:3000/api/trpc'});
c.contact.list.query({page:1,pageSize:10}).then(r => console.log(r));
"
# 返回: { items: [], total: 0, page: 1, pageSize: 10 }
```

**V4 — 前端页面渲染**

- 启动前端 `pnpm --filter @opencode/admin dev`
- 登录管理后台 → 侧边栏出现"访客档案"
- 访客列表页正常渲染（空列表）
- 点击新建 → 表单正常

**V5 — 类型检查**

```bash
pnpm type-check  # 全仓库类型检查通过
```

> **Phase 2.1 通过条件**: V1 + V2 + V3 + V4 + V5 全部成功 → 进入 Phase 2.2

---

## Phase 2.2: 对话会话与消息归档 [3-4天]

**目标**: 消息自动归档到 DB，后台可查看对话历史、人工回复。

### 任务

| #     | 任务                                       | 文件                                                                       |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------- |
| 2.2.1 | ConversationSessionService                 | `apps/api/src/modules/conversation/services/session.service.ts`            |
| 2.2.2 | ConversationMessageService                 | `apps/api/src/modules/conversation/services/message.service.ts`            |
| 2.2.3 | ConversationCacheService (Redis)           | `apps/api/src/modules/conversation/services/conversation-cache.service.ts` |
| 2.2.4 | Conversation tRPC Router                   | `apps/api/src/modules/conversation/trpc/conversation.router.ts`            |
| 2.2.5 | Conversation Module + 注册                 | `apps/api/src/modules/conversation/module.ts`                              |
| 2.2.6 | 修改 WechatKf Webhook：接收消息时自动归档  | `apps/api/src/modules/wechat-kf/rest/kf.controller.ts`                     |
| 2.2.7 | 会话列表前端页                             | `apps/admin/src/modules/conversations/pages/ConversationListPage.tsx`      |
| 2.2.8 | 会话详情前端页 (聊天气泡 + 人工回复)       | `apps/admin/src/modules/conversations/pages/ConversationDetailPage.tsx`    |
| 2.2.9 | ChatBubble + MessageList + AdminReplyInput | `apps/admin/src/modules/conversations/components/`                         |

### 消息归档流程（Round 2 阶段，无 AI）

```
POST /webhook/wechat-kf
  → AES 解密
  → Contact.findOrCreateByOpenId(openId, utm)
  → Session.getOrCreate(sessionKey)
  → Message.createAndArchive(user message)
  → (不调 AI，仅归档)
  → 返回 200（微信要求 5s 内）
```

### 人工回复流程

```
管理员在会话详情页输入回复
  → conversationSession.adminReply({ sessionId, content })
  → Message.createAndArchive(assistant message)
  → WechatKfService.sendText(openId, content)
  → 用户在微信客服窗口收到消息
```

### 核心方法

- `getOrCreate(sessionKey, contactId, utmSource)` — Redis 优先，DB fallback
- `createAndArchive(sessionId, role, content, ...)` — 加密写入 DB + 更新 Redis
- `adminReply(sessionId, content)` — 写入消息 + 调用微信发送

### 验证方案

**V1 — 消息归档端到端（微信真实消息）**

- 用微信向客服发送 "你好"
- 检查数据库:

```sql
SELECT * FROM contacts ORDER BY created_at DESC LIMIT 1;
-- 应有 1 条记录，open_id 非空
SELECT * FROM conversation_sessions ORDER BY created_at DESC LIMIT 1;
-- 应有 1 条记录，contact_id 关联正确
SELECT * FROM conversation_messages ORDER BY created_at DESC LIMIT 1;
-- 应有 1 条记录，role='user'，content 加密存储
```

**V2 — 消息加密存储验证**

```bash
# 直接查 DB，content 应为密文
npx prisma studio
# conversation_messages.content 显示为乱码/base64，非明文
```

**V3 — 人工回复端到端**

- 在管理后台 → 会话列表 → 点击会话进入详情
- 详情页显示聊天气泡（用户消息右对齐）
- 在底部输入框输入 "您好，请问有什么可以帮您？" → 点击发送
- 微信端收到该消息
- 数据库新增 1 条 role='assistant' 的消息

**V4 — Redis 缓存验证**

```bash
# 发送消息后检查 Redis
redis-cli GET "session:meta:{sessionKey}"
# 返回 JSON: {state, intentLevel, turnCount}
redis-cli LRANGE "session:messages:{sessionKey}" 0 -1
# 返回消息数组
```

**V5 — Redis 缓存回填**

```bash
# 清除 Redis 缓存
redis-cli DEL "session:meta:{sessionKey}" "session:messages:{sessionKey}"
# 再次发消息 → 后端日志无报错 → 从 DB 回填成功
```

**V6 — 前端页面完整验证**

- 会话列表页：显示会话、状态标签、意向标签、轮次、最后活跃时间
- 会话详情页：聊天气泡正确、消息按时间排序、输入框可输入
- 访客档案页：关联会话数显示

**V7 — 类型检查**

```bash
pnpm type-check
```

> **Phase 2.2 通过条件**: V1 + V2 + V3 + V6 + V7 成功 → 进入 Phase 2.3
> **V4 + V5 为 Redis 缓存验证**：可选，但建议执行

---

## Phase 2.3: 人工接管队列 + 菜单集成 [2天]

**目标**: EscalationQueue + 前端路由/菜单/权限完整集成。

### 任务

| #     | 任务                        | 文件                                                                   |
| ----- | --------------------------- | ---------------------------------------------------------------------- |
| 2.3.1 | EscalationQueue 模型 + 枚举 | `schema.prisma`                                                        |
| 2.3.2 | EscalationQueueService      | `apps/api/src/modules/escalation/services/escalation-queue.service.ts` |
| 2.3.3 | Escalation tRPC Router      | `apps/api/src/modules/escalation/trpc/escalation.router.ts`            |
| 2.3.4 | Escalation Module + 注册    | `apps/api/src/modules/escalation/module.ts`                            |
| 2.3.5 | 接管队列前端页              | `apps/admin/src/modules/escalation/pages/EscalationListPage.tsx`       |
| 2.3.6 | 路由 + 菜单 + 权限注册      | `App.tsx`, `AdminLayout.tsx`, seed                                     |

### Round 2 菜单结构

```
销售中心
  ├─ 会话管理 /conversations
  ├─ 访客档案 /contacts
  └─ 接管队列 /escalation
微信客服
  └─ 客服配置 /wechat-kf
```

### 验证方案

**V1 — Escalation CRUD**

```bash
# tRPC 调用测试
c.escalationQueue.list.query({page:1,pageSize:10})
# 返回: { items: [], total: 0 }
```

**V2 — 菜单与路由完整验证**

- 登录管理后台
- 侧边栏显示: 销售中心(会话管理/访客档案/接管队列) + 微信客服(客服配置)
- 点击每个菜单项 → 页面正常渲染，无 404
- 浏览器直接访问 /conversations → 正常（非白屏）

**V3 — 权限验证**

- 用 VIEWER 角色登录 → 菜单可见但无"新建/删除"按钮
- 用 ADMIN 角色登录 → 所有操作可用
- 无权限用户访问 /conversations → 跳转 403 或隐藏菜单

**V4 — 接管队列操作**

- 在会话详情页点击"转人工" → escalation_queue 新增记录
- 接管队列列表页显示该记录，状态为 PENDING
- 点击"接管" → 状态变为 IN_PROGRESS，assignedTo 为当前管理员
- 点击"标记已解决" → 状态变为 RESOLVED

**V5 — 类型检查 + 构建**

```bash
pnpm type-check && pnpm build-all
```

> **Round 2 通过条件**: V2 + V3 + V5 成功 → 进入 Round 3
> **Round 2 里程碑：运营在自家后台看/回所有对话，不用切企微**

### Round 2 交付物

- 微信客服消息自动归档
- 运营在后台看所有对话、直接回复
- 访客档案自动建立
- 人工接管队列
- **运营不用切企微，在自家后台完成所有对话工作**

---

# Round 3: AI 自动对话 + 商品体系 [6-9天]

> 目标：商品可配置，AI 7×24 自动销售，模拟支付卡片（不接真支付）。
> 人工仅处理 AI 转接的对话。

## Phase 3.1: 商品管理模块 [2-3天]

**目标**: Product CRUD，商家在后台录入/管理商品。

### 任务

| #     | 任务                                        | 文件                                                         |
| ----- | ------------------------------------------- | ------------------------------------------------------------ |
| 3.1.1 | Product 模型                                | `schema.prisma`                                              |
| 3.1.2 | ProductService (extends BaseService)        | `apps/api/src/modules/product/services/product.service.ts`   |
| 3.1.3 | Product tRPC Router                         | `apps/api/src/modules/product/trpc/product.router.ts`        |
| 3.1.4 | Product Module + 注册                       | `apps/api/src/modules/product/module.ts`                     |
| 3.1.5 | 商品列表前端页                              | `apps/admin/src/modules/products/pages/ProductListPage.tsx`  |
| 3.1.6 | 商品表单（图片上传 + JSON 规格 + 拖拽排序） | `apps/admin/src/modules/products/components/ProductForm.tsx` |

### Product 模型

```prisma
model Product {
  id            BigInt    @id @default(autoincrement())
  name          String
  description   String?   @db.Text
  priceFen      Int       @map("price_fen")
  originalPriceFen Int?   @map("original_price_fen")
  imageUrl      String?   @map("image_url")
  specs         Json?
  sortWeight    Int       @default(0) @map("sort_weight")
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  orders        Order[]

  @@map("products")
}
```

### 核心方法

- `getActiveProducts()` — 查询上架商品，按 sortWeight 排序（供 AI 引擎调用）
- `toggleActive(id)` — 上架/下架
- `reorder(ids[])` — 批量更新 sortWeight

### 验证方案

**V1 — Product CRUD 端到端**

- 管理后台 → 商品管理 → 点击"新建"
- 填写: 名称="入门版", 售价=299, 原价=399, 描述="1-3坐席"
- 上传商品图片 → 图片显示
- JSON 规格编辑器: 添加 `{"坐席数": "1-3", "试用天数": 7}` → 保存成功
- 商品列表显示新商品，状态为"已上架"

**V2 — 商品上下架**

- 点击"下架" → isActive=false，列表显示"已下架"标签
- 点击"上架" → isActive=true
- `getActiveProducts()` 只返回 isActive=true 的商品

**V3 — 拖拽排序**

- 新建 3 个商品 → 拖拽调整顺序 → 刷新页面 → 顺序保持

**V4 — 图片上传**

- 上传 PNG/JPG → 成功，图片可预览
- 上传 > 10MB 文件 → 提示"文件过大"

**V5 — tRPC 验证**

```bash
c.product.list.query({page:1,pageSize:10})
# 返回商品列表
c.product.getOne.query({id:"1"})
# 返回商品详情，specs 为 JSON 对象
```

**V6 — 类型检查**

```bash
pnpm type-check
```

> **Phase 3.1 通过条件**: V1 + V2 + V3 + V6 成功 → 进入 Phase 3.2

---

## Phase 3.2: AI Agent 引擎 [3-4天]

**目标**: DeepSeek AI 引擎，动态商品目录注入，状态机驱动，商品推荐。

### 任务

| #     | 任务                                       | 文件                                                                  |
| ----- | ------------------------------------------ | --------------------------------------------------------------------- |
| 3.2.1 | AgentEngineService (核心)                  | `apps/api/src/modules/agent-engine/services/agent-engine.service.ts`  |
| 3.2.2 | System Prompt 模板（含 {product_catalog}） | `apps/api/src/modules/agent-engine/prompts/sales-agent.prompt.ts`     |
| 3.2.3 | DeepSeek API 客户端                        | `apps/api/src/modules/agent-engine/services/deepseek.service.ts`      |
| 3.2.4 | 状态机验证器                               | `apps/api/src/modules/agent-engine/services/state-machine.service.ts` |
| 3.2.5 | AgentEngineConfig 模型                     | `schema.prisma`                                                       |
| 3.2.6 | AgentEngine tRPC Router                    | `apps/api/src/modules/agent-engine/trpc/agent-engine.router.ts`       |
| 3.2.7 | AgentEngine Module + 注册                  | `apps/api/src/modules/agent-engine/module.ts`                         |
| 3.2.8 | 引擎配置前端页 + Prompt 测试页             | `apps/admin/src/modules/agent-engine/pages/`                          |

### 商品目录动态注入

`buildPrompt()` 每次调用时：

1. 查询 `ProductService.getActiveProducts()` 获取上架商品
2. 格式化注入 `{product_catalog}` 占位符：

```
【商品目录】
1. 入门版 | 299元/月 | 原价399元 | 规格: 1-3坐席, 7天试用
2. 成长版 | 799元/月 | 原价999元 | 规格: 4-10坐席, 7天试用
```

3. 商品目录为空 → 注入"当前无上架商品，引导留资"，不发支付卡片

### AI 响应格式

```json
{
  "reply": "发给用户的消息",
  "state_transition": "STAY|NEEDS_DISCOVERY|PRODUCT_MATCH|...",
  "intent_level": "LOW|MEDIUM|HIGH|CLOSING",
  "confidence": 0.85,
  "recommended_product_id": 2,
  "send_payment_card": false,
  "closing_chip": null,
  "escalation_reason": null,
  "internal_note": "内部分析备注"
}
```

### 验证方案

**V1 — DeepSeek API 连通**

```bash
# 在 .env 中配置 DEEPSEEK_API_KEY
curl https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}]}'
# 返回 200 + AI 回复
```

**V2 — AgentEngineService 单元测试**

```bash
npx jest agent-engine.service.spec.ts
# 测试用例:
# - buildPrompt: 包含 {product_catalog} 占位符被替换为商品目录文本
# - buildPrompt: 商品目录为空时注入"无上架商品"提示
# - parseResponse: 正常 JSON 解析 → AgentResponse 对象
# - parseResponse: 非 JSON 响应 → 抛出解析错误
# - parseResponse: 缺少必要字段 → 抛出验证错误
# - fallback: 每个状态都有兜底回复
# - fallback: 不触发状态转换
```

**V3 — 状态机验证**

```bash
npx jest state-machine.service.spec.ts
# 测试用例:
# - GREETING → NEEDS_DISCOVERY: 合法
# - GREETING → CLOSING: 非法，拒绝
# - CLOSING → CONVERTED: 合法
# - CONVERTED → *: 非法（终态）
# - 任意非终态 → ESCALATED: 合法
```

**V4 — Prompt 测试页端到端**

- 管理后台 → AI 引擎 → Prompt 测试
- 选择引擎配置 → 输入"我是做 B 端销售的" → 点击"发送"
- 页面显示 AI 回复 + 状态转换标签（如 GREETING → NEEDS_DISCOVERY）
- AI 响应 JSON 面板显示: reply, state_transition, intent_level, recommended_product_id

**V5 — 商品目录注入验证**

- 后台录入 2 个上架商品 → Prompt 测试页发送消息
- AI 回复中提及商品信息（名称/价格）
- 后台下架所有商品 → AI 回复不再提及商品，不发支付卡片

**V6 — fallback 验证**

- 临时设置错误的 DEEPSEEK_API_KEY → 发送消息 → 收到兜底回复而非报错
- 恢复正确 API Key → AI 正常回复

**V7 — 类型检查**

```bash
pnpm type-check
```

> **Phase 3.2 通过条件**: V1 + V2 + V3 + V4 + V5 + V7 成功 → 进入 Phase 3.3

---

## Phase 3.3: 消息处理管线串联 [2-3天]

**目标**: 端到端串联：微信消息 → Contact → Session → AI → 回复 → 模拟支付卡片/转人工。

### 任务

| #     | 任务                              | 文件                                                                     |
| ----- | --------------------------------- | ------------------------------------------------------------------------ |
| 3.3.1 | MessagePipelineService            | `apps/api/src/modules/conversation/services/message-pipeline.service.ts` |
| 3.3.2 | 修改 WechatKf Controller 调用管线 | `apps/api/src/modules/wechat-kf/rest/kf.controller.ts`                   |
| 3.3.3 | 并发控制 (Redis 分布式锁)         | 同 3.3.1                                                                 |
| 3.3.4 | 消息去重 (Redis setex)            | 同 3.3.1                                                                 |
| 3.3.5 | Conversation Module 更新          | `apps/api/src/modules/conversation/module.ts`                            |

### 管线流程

```
用户消息 → AES解密 → Contact.findOrCreate → Session.getOrCreate
→ Message.createAndArchive(user) → AgentEngine.process
→ Session.updateStateAtomic → Message.createAndArchive(ai)
→ 判断 sendPaymentCard + recommended_product_id
    → 【Round 3 模拟】仅记录日志 + 发送文字"支付链接即将上线"
    → 【Round 4 真实】OrderService.create + PaymentService.createH5Order + WechatKf.sendLink
→ 判断 escalate → EscalationQueue.create
→ WechatKf.sendText(reply)
```

### 验证方案

**V1 — 端到端 AI 对话（微信真实消息）**

- 用微信向客服发送 "你好"
- 3-10 秒内收到 AI 自动回复（非人工）
- 管理后台 → 会话列表 → 该会话状态为 NEEDS_DISCOVERY 或 GREETING
- 会话详情页显示用户消息 + AI 回复的聊天气泡

**V2 — 多轮对话状态推进**

- 发送 "我是做销售的" → AI 回复探询痛点
- 发送 "经常漏单" → AI 回复匹配产品，状态推进到 PRODUCT_MATCH
- 发送 "多少钱" → AI 回复价格，intent_level 变为 HIGH
- 发送 "怎么付款" → AI 回复 + 发送文字"支付链接即将上线"（模拟）

**V3 — AI 推荐商品绑定**

- AI 判断发支付卡片时，conversation_messages 表中:
  - `ai_intent_level` = 'CLOSING' 或 'HIGH'
  - `send_payment_card` = true
  - `recommended_product_id` 有值且对应上架商品

**V4 — 转人工**

- 发送 "转人工" → AI 回复"正在为您转接..."
- escalation_queue 新增记录，reason = USER_REQUESTED
- 管理后台接管队列 Badge +1
- 会话状态变为 ESCALATED

**V5 — 并发安全**

- 两个微信号同时向客服发消息 → 各自 session 独立
- 同一用户快速连发 3 条 → 消息按序处理，状态不错乱

**V6 — 消息去重**

- 检查后端日志: 同一 msgId 不出现两次处理记录

**V7 — 类型检查**

```bash
pnpm type-check
```

> **Round 3 通过条件**: V1 + V2 + V3 + V4 + V7 成功 → 进入 Round 4
> **V5 + V6 为并发/去重验证**：建议执行
> **Round 3 里程碑：AI 7×24 自动销售，人工仅处理转接**

### Round 3 菜单新增

```
商品管理
  └─ 商品列表 /products
AI 引擎
  ├─ 引擎配置 /agent-engine
  └─ Prompt 测试 /agent-engine/test
```

### Round 3 交付物

- 商品后台可配置
- AI 7×24 自动销售对话
- AI 根据对话上下文推荐商品
- 模拟支付卡片（文字提示）
- 人工仅处理 AI 转接的对话
- **AI 自动化验证完成，准备接入真实支付**

---

# Round 4: 支付闭环 + 订单履约 + 仪表盘 [7-10天]

> 目标：真实支付闭环，订单管理/导出/履约，仪表盘数据可视化。
> 全自动销售闭环：从对话到付款到履约。

## Phase 4.1: 订单与支付模块 [3-4天]

**目标**: Order 模型 + H5 支付 + 支付回调幂等 + 支付卡片真实发送。

### 任务

| #     | 任务                               | 文件                                                            |
| ----- | ---------------------------------- | --------------------------------------------------------------- |
| 4.1.1 | Order 模型 + 枚举                  | `schema.prisma`                                                 |
| 4.1.2 | OrderService (extends BaseService) | `apps/api/src/modules/order/services/order.service.ts`          |
| 4.1.3 | H5 下单扩展                        | `apps/api/src/modules/payment/services/wechat-pay.service.ts`   |
| 4.1.4 | 支付回调 Controller (幂等)         | `apps/api/src/modules/payment/rest/payment.controller.ts`       |
| 4.1.5 | PaymentCardService                 | `apps/api/src/modules/payment/services/payment-card.service.ts` |
| 4.1.6 | Order tRPC Router                  | `apps/api/src/modules/order/trpc/order.router.ts`               |
| 4.1.7 | Order Module + 注册                | `apps/api/src/modules/order/module.ts`                          |
| 4.1.8 | 修改管线：模拟支付 → 真实支付      | `message-pipeline.service.ts`                                   |

### Order 模型

```prisma
model Order {
  id              BigInt       @id @default(autoincrement())
  orderNo         String       @unique @map("order_no")
  contactId       BigInt       @map("contact_id")
  sessionId       BigInt       @map("session_id")
  productId       BigInt       @map("product_id")
  outTradeNo      String       @unique @map("out_trade_no")
  transactionId   String?      @map("transaction_id")
  productName     String       @map("product_name")
  closingChip     String?      @db.Text @map("closing_chip")
  amountFen       Int          @map("amount_fen")
  status          OrderStatus  @default(PENDING)
  fulfillStatus   FulfillStatus @default(UNFULFILLED) @map("fulfill_status")
  customerName    String?      @map("customer_name")       // AES 加密
  customerPhone   String?      @map("customer_phone")      // AES 加密
  customerAddress String?      @db.Text @map("customer_address") // AES 加密
  paidAt          DateTime?    @map("paid_at")
  fulfilledAt     DateTime?    @map("fulfilled_at")
  expiresAt       DateTime     @map("expires_at")
  rawCallback     Json?        @map("raw_callback")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  contact         Contact      @relation(fields: [contactId], references: [id])
  session         ConversationSession @relation(fields: [sessionId], references: [id])
  product         Product      @relation(fields: [productId], references: [id])

  @@index([status, createdAt])
  @@index([fulfillStatus, createdAt])
  @@map("orders")
}
```

### OrderService 核心方法

- `create(contactId, sessionId, productId, closingChip?)` — 生成 orderNo + 创建 Order + 微信 H5 下单
- `markPaid(id, transactionId, paidAt)` — 幂等更新 + Contact.markConverted
- `updateFulfillStatus(id, status)` — 更新履约状态
- `updateCustomerInfo(id, name, phone, address)` — 补录客户信息（加密）
- `getByOutTradeNo(outTradeNo)` — 幂等查询

### 幂等处理

以 outTradeNo 为幂等键，已 PAID 则直接返回 200。事务中同时更新 Order + Contact。

### 验证方案

**V1 — H5 下单**

- 在微信客服中触发 AI 发送支付卡片（说"怎么付款"）
- 用户收到链接消息 → 点击 → 跳转微信支付中间页
- 后端日志: `createH5Order` 返回 h5_url

**V2 — 支付完成端到端**

- 在微信支付中间页完成支付
- 后端收到支付回调 → 日志: `markPaid` 成功
- 数据库验证:

```sql
SELECT status, paid_at FROM orders ORDER BY created_at DESC LIMIT 1;
-- status='PAID', paid_at 有值
SELECT status, converted_at FROM contacts ORDER BY updated_at DESC LIMIT 1;
-- status='CONVERTED', converted_at 有值
```

- 用户在微信客服收到支付成功欢迎消息

**V3 — 支付回调幂等**

- 手动重发同一支付回调 3 次:

```bash
curl -X POST http://localhost:3000/api/webhook/wxpay -d @callback_body.json
# 连续发 3 次
```

- 数据库 orders 表只有 1 条 PAID 记录，无重复

**V4 — Order 关联商品**

```sql
SELECT o.order_no, o.product_name, o.amount_fen, p.name, p.price_fen
FROM orders o JOIN products p ON o.product_id = p.id
ORDER BY o.created_at DESC LIMIT 1;
-- product_name = p.name, amount_fen = p.price_fen
```

**V5 — 类型检查**

```bash
pnpm type-check
```

> **Phase 4.1 通过条件**: V1 + V2 + V3 + V5 成功 → 进入 Phase 4.2
> **V1 + V2 需微信支付测试环境**：沙箱环境或小额真实支付

---

## Phase 4.2: 订单管理前端 + 导出 [2-3天]

**目标**: 订单列表/详情/导出/履约操作。

### 任务

| #     | 任务                                      | 文件                                                             |
| ----- | ----------------------------------------- | ---------------------------------------------------------------- |
| 4.2.1 | 订单列表前端页（多维筛选 + 导出按钮）     | `apps/admin/src/modules/orders/pages/OrderListPage.tsx`          |
| 4.2.2 | 订单详情前端页（履约操作 + 客户信息补录） | `apps/admin/src/modules/orders/pages/OrderDetailPage.tsx`        |
| 4.2.3 | 订单导出 REST 端点                        | `apps/api/src/modules/order/rest/order.controller.ts`            |
| 4.2.4 | 订单导出组件                              | `apps/admin/src/modules/orders/components/OrderExportButton.tsx` |

### 订单导出

- `GET /api/orders/export?status=PAID&fulfillStatus=UNFULFILLED&productId=1&from=&to=&format=csv|xlsx`
- 导出时自动解密 customerPhone
- 中文列标题：订单号、商品名称、金额(元)、支付状态、履约状态、客户姓名、客户电话、客户地址、下单时间、支付时间
- CSV: BOM + UTF-8
- XLSX: exceljs

### 验证方案

**V1 — 订单列表页**

- 管理后台 → 订单管理 → 列表显示订单
- 筛选: 支付状态=PAID → 只显示已支付订单
- 筛选: 履约状态=UNFULFILLED → 只显示未履约订单
- 筛选: 商品=入门版 → 只显示该商品订单
- 日期筛选: 选择今天 → 只显示今天订单

**V2 — 订单详情页**

- 点击订单 → 详情页显示: 订单号、商品名、金额、支付状态、履约状态
- 履约操作: 点击"标记处理中" → fulfillStatus 变为 PROCESSING
- 履约操作: 点击"标记已完成" → fulfillStatus 变为 COMPLETED
- 客户信息补录: 输入姓名/电话/地址 → 保存成功 → 刷新后信息保持

**V3 — CSV 导出**

```bash
curl "http://localhost:3000/api/orders/export?format=csv&status=PAID" \
  -H "Authorization: Bearer $TOKEN" -o orders.csv
```

- 文件以 BOM (\xEF\xBB\xBF) 开头
- 列标题为中文: 订单号,商品名称,金额(元),...
- customerPhone 列显示解密后明文
- Excel 打开不乱码

**V4 — XLSX 导出**

```bash
curl "http://localhost:3000/api/orders/export?format=xlsx&status=PAID" \
  -H "Authorization: Bearer $TOKEN" -o orders.xlsx
```

- 文件可被 Excel 正常打开
- 列标题中文，数据完整

**V5 — 类型检查**

```bash
pnpm type-check
```

> **Phase 4.2 通过条件**: V1 + V2 + V3 + V5 成功 → 进入 Phase 4.3

---

## Phase 4.3: 仪表盘与实时推送 [3-4天]

**目标**: Dashboard 统计 + 图表 + SSE 实时推送。

### 任务

| #     | 任务                                          | 文件                                                       |
| ----- | --------------------------------------------- | ---------------------------------------------------------- |
| 4.3.1 | StatsService                                  | `apps/api/src/modules/stats/services/stats.service.ts`     |
| 4.3.2 | SseService (连接池 + 广播)                    | `apps/api/src/modules/stats/services/sse.service.ts`       |
| 4.3.3 | Stats REST Controller + tRPC Router           | `apps/api/src/modules/stats/`                              |
| 4.3.4 | SSE 事件集成                                  | MessagePipeline, Order, Escalation                         |
| 4.3.5 | 仪表盘前端页                                  | `apps/admin/src/modules/dashboard/pages/DashboardPage.tsx` |
| 4.3.6 | SSE Hook                                      | `apps/admin/src/shared/hooks/useSSE.ts`                    |
| 4.3.7 | 统计卡片 + 趋势图 + Top 商品排行 + 实时消息流 | `apps/admin/src/modules/dashboard/components/`             |

### StatsService 指标

- **KPI 卡片**: 今日新增访客、活跃会话数、今日成交额、转化率、客单价
- **趋势图**: 近 N 天每日数据
- **来源分布**: UTM 来源饼图
- **Top 商品排行**: 按成交金额/数量排序

### SSE 事件

```
NEW_SESSION  → 刷新会话列表
ESCALATED    → 刷新接管队列，Badge +1
ORDER_PAID   → Dashboard 成交 +1，刷新订单
```

### 验证方案

**V1 — 仪表盘数据正确**

- 管理后台 → 仪表盘
- KPI 卡片数值与数据库一致:

```sql
-- 今日新增访客
SELECT COUNT(*) FROM contacts WHERE created_at >= CURRENT_DATE;
-- 今日成交额
SELECT COALESCE(SUM(amount_fen),0) FROM orders WHERE status='PAID' AND paid_at >= CURRENT_DATE;
-- 转化率
-- (今日 PAID 订单数 / 今日新增会话数) * 100
```

- 客单价 = 今日成交额 / 今日 PAID 订单数

**V2 — 趋势图**

- 选择"近 7 天" → 折线图显示 7 个数据点
- 鼠标悬停 → tooltip 显示日期 + 数值

**V3 — Top 商品排行**

- 显示按成交金额排序的商品列表
- 数值与数据库一致:

```sql
SELECT p.name, SUM(o.amount_fen) as total
FROM orders o JOIN products p ON o.product_id = p.id
WHERE o.status='PAID' GROUP BY p.id ORDER BY total DESC;
```

**V4 — SSE 实时推送**

- 打开仪表盘页面 → 保持连接
- 另一端: 用微信发起新对话 → 仪表盘"今日新增访客"实时 +1
- 完成一笔支付 → 仪表盘"今日成交额"实时更新
- 触发转人工 → 接管队列 Badge 实时 +1

**V5 — SSE 断线重连**

- 暂停网络 5 秒 → 恢复 → SSE 自动重连 → 数据恢复更新

**V6 — 类型检查**

```bash
pnpm type-check
```

> **Phase 4.3 通过条件**: V1 + V2 + V3 + V6 成功 → 进入 Phase 4.4
> **V4 + V5 为 SSE 验证**：建议执行

---

## Phase 4.4: 定时任务 + 最终集成 [1-2天]

**目标**: BullMQ 定时任务 + 前端最终路由/菜单/权限集成。

### 任务

| #     | 任务                   | 文件                                                            |
| ----- | ---------------------- | --------------------------------------------------------------- |
| 4.4.1 | BullMQ 基础设施        | `apps/api/src/shared/services/queue.service.ts`                 |
| 4.4.2 | 超时唤醒 Job (48h)     | `apps/api/src/modules/conversation/jobs/session-timeout.job.ts` |
| 4.4.3 | 过期会话关闭 Job (72h) | `apps/api/src/modules/conversation/jobs/session-expire.job.ts`  |
| 4.4.4 | 过期订单关闭 Job       | `apps/api/src/modules/order/jobs/order-expire.job.ts`           |
| 4.4.5 | 最终菜单/路由/权限集成 | `App.tsx`, `AdminLayout.tsx`, seed                              |

### Round 4 最终菜单结构

```
销售中心
  ├─ 仪表盘 /dashboard
  ├─ 会话管理 /conversations
  ├─ 访客档案 /contacts
  └─ 接管队列 /escalation
商品管理
  └─ 商品列表 /products
订单管理
  └─ 订单列表 /orders
微信客服
  └─ 客服配置 /wechat-kf
AI 引擎
  ├─ 引擎配置 /agent-engine
  └─ Prompt 测试 /agent-engine/test
```

### 验证方案

**V1 — BullMQ Job 注册**

```bash
# 启动后端后检查日志
# 出现: "BullMQ queue registered: session-timeout"
# 出现: "BullMQ queue registered: session-expire"
# 出现: "BullMQ queue registered: order-expire"
```

**V2 — 过期订单关闭（时间加速测试）**

- 创建一笔 PENDING 订单，手动设置 expiresAt 为过去时间:

```sql
UPDATE orders SET expires_at = NOW() - INTERVAL '1 hour' WHERE status = 'PENDING';
```

- 等待 Job 执行（或手动触发）→ 订单 status 变为 EXPIRED

**V3 — 超时唤醒（时间加速测试）**

- 创建一个会话，手动设置 lastActiveAt 为 49 小时前:

```sql
UPDATE conversation_sessions SET last_active_at = NOW() - INTERVAL '49 hours' WHERE state NOT IN ('CONVERTED','TIMED_OUT','ESCALATED');
```

- 等待 Job 执行 → 用户收到唤醒消息 → lastActiveAt 更新

**V4 — 完整菜单验证**

- 登录管理后台 → 侧边栏显示完整菜单:
  - 销售中心: 仪表盘/会话管理/访客档案/接管队列
  - 商品管理: 商品列表
  - 订单管理: 订单列表
  - 微信客服: 客服配置
  - AI 引擎: 引擎配置/Prompt 测试
- 每个菜单项点击 → 页面正常渲染

**V5 — 权限完整验证**

- SUPER_ADMIN: 所有菜单可见，所有操作可用
- ADMIN: 所有菜单可见，CRUD 可用
- VIEWER: 菜单可见，但新建/编辑/删除按钮隐藏

**V6 — 全量构建**

```bash
pnpm build-all  # 全仓库构建成功
pnpm type-check  # 类型检查通过
```

**V7 — 端到端冒烟测试（完整闭环）**

1. 落地页点击客服 → 发起对话
2. 发送 "你好" → AI 自动回复
3. 多轮对话 → AI 推荐商品 → 发送支付卡片
4. 完成支付 → 订单生成 → Contact 转化
5. 管理后台 → 订单列表 → 导出 CSV
6. 订单详情 → 更新履约状态为 COMPLETED
7. 仪表盘 → 数据正确更新

> **Round 4 通过条件**: V4 + V5 + V6 + V7 成功 → 项目交付
> **Round 4 里程碑：全自动销售闭环，从对话到付款到履约**

### Round 4 交付物

- 真实支付闭环
- 订单管理/导出/履约
- 仪表盘数据可视化
- SSE 实时推送
- 定时任务
- **全自动销售闭环：从对话到付款到履约**

---

## 总预估

| Round    | 阶段          | 预估        | 交付物                   |
| -------- | ------------- | ----------- | ------------------------ |
| Round 1  | Phase 1.1-1.3 | 3-5天       | 落地页上线，获取真实反馈 |
| Round 2  | Phase 2.1-2.3 | 5-7天       | 后台看/回对话，访客档案  |
| Round 3  | Phase 3.1-3.3 | 6-9天       | AI 自动销售 + 商品体系   |
| Round 4  | Phase 4.1-4.4 | 7-10天      | 支付闭环 + 订单 + 仪表盘 |
| **总计** |               | **21-31天** | **约 4-6 周**            |

---

## v5.1 vs v5.0 对比

| 维度           | v5.0 顺序                     | v5.1 顺序                    |
| -------------- | ----------------------------- | ---------------------------- |
| 起点           | 数据模型 → 加密 → 服务 → 前端 | 落地页 → 微信客服 → 后台对话 |
| 首个可验证交付 | 全部数据模型                  | 可访问的落地页               |
| 人工介入时机   | Round 4 之后                  | Round 1 就有（企微后台）     |
| AI 接入时机    | Phase 4                       | Round 3                      |
| 支付接入时机   | Phase 6                       | Round 4                      |
| 反馈获取       | 全部完成后                    | 第 1 周即可获取              |
| 风险控制       | 后期集中验证                  | 每轮独立验证                 |

---

## 关键文件清单

| 文件                                                          | 用途                       |
| ------------------------------------------------------------- | -------------------------- |
| `infra/database/prisma/schema.prisma`                         | 所有新模型和枚举的定义起点 |
| `infra/shared/src/index.ts`                                   | Zod schema + 类型定义      |
| `apps/api/src/common/base.service.ts`                         | 所有新 Service 的基类      |
| `apps/api/src/trpc/trpc.helper.ts`                            | createCrudRouter 生成基础  |
| `apps/api/src/trpc/app.router.ts`                             | tRPC 路由合并注册          |
| `apps/api/src/app.module.ts`                                  | NestJS 模块注册中心        |
| `apps/api/src/modules/wecom/services/wecom-crypto.service.ts` | AES 加解密参考实现         |
| `apps/api/src/shared/services/redis.service.ts`               | Redis 缓存服务             |
| `apps/admin/src/shared/layouts/AdminLayout.tsx`               | 菜单配置                   |
| `apps/admin/src/App.tsx`                                      | 前端路由注册               |

## 端到端验收测试

1. 微信内点击客服按钮 → 3s 内弹出对话框，收到开场白
2. 发送文字消息 → 8s 内收到 AI 回复（P95），回复参考商品目录
3. 发送图片 → 收到降级文案，不报错
4. 发送"怎么付款" → AI 推荐 matching 商品 → 收到支付卡片（绑定推荐商品）
5. 完成支付 → Order.status=PAID，Contact.status=CONVERTED，收到欢迎消息
6. 相同回调发 3 次 → 业务逻辑只执行 1 次
7. Redis 重启后发消息 → 历史从 DB 恢复，上下文不丢失
8. 说"转人工" → escalation_queue 新增记录，管理后台 Badge +1
9. 10 并发用户同时对话 → 各自 session 独立，无数据混乱
10. 管理员发人工接管消息 → 用户在微信客服窗口收到消息
11. 后台录入新商品 → AI 下一轮对话自动推荐新商品
12. 商品全部下架 → AI 不发支付卡片，引导留资
13. 订单导出 CSV → 电话解密，中文列标题，Excel 不乱码
14. 商家更新履约状态 → Order.fulfillStatus 正确流转
15. 超时未支付订单 → 自动标记 EXPIRED
