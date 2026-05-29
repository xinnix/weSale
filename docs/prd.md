# AI 销售 Agent 系统

## 产品规格文档 v4.0 — 基于 OpenCode Scaffold

> 本文档已与 OpenCode Scaffold 对齐。
> 开发时优先复用脚手架内置模块，新增业务遵循脚手架既有模式。

---

## 一、产品定义

访客访问落地页 → 点击微信客服按钮 → DeepSeek AI Agent 全自动对话
→ 识别购买意向 → 发送支付链接 → 付款 → 账户自动开通。

产品卖自己：AI Agent 通过这次对话，把"AI 销售 Agent 系统"本身卖给访客。
访客在被 AI 说服的过程中，亲身体验了产品的核心能力。

---

## 二、技术栈（脚手架对齐）

| 层          | 选型                                 | 说明         |
| ----------- | ------------------------------------ | ------------ |
| Backend     | NestJS + tRPC + Prisma               | 脚手架标准   |
| 数据库      | PostgreSQL                           | 脚手架标准   |
| 缓存 / 队列 | Redis + BullMQ                       | 脚手架标准   |
| Admin UI    | React + Refine + Ant Design 5 + tRPC | 脚手架标准   |
| 落地页      | Next.js                              | 独立应用     |
| AI          | DeepSeek API（OpenAI 兼容）          | 新增         |
| 微信支付    | 已内置（payment 模块）               | 扩展 H5 场景 |
| 微信集成    | 已内置（wechat 模块）                | 扩展 KF 接入 |

**DeepSeek 接入**（OpenAI SDK，改 base_url）：

```
base_url : https://api.deepseek.com
model    : deepseek-chat
```

---

## 三、模块地图

### 3.1 复用脚手架内置模块（不重复造轮子）

| 脚手架模块            | 本项目用途                                  |
| --------------------- | ------------------------------------------- |
| `auth`                | 管理员登录、JWT 签发、Token 刷新            |
| `admin`               | 管理员 CRUD（运营人员账号）                 |
| `role` / `permission` | 管理员 RBAC（VIEWER / ADMIN / SUPER_ADMIN） |
| `payment`             | 微信支付基础能力，**扩展 H5 支付场景**      |
| `wechat`              | 微信基础 API，**扩展微信客服（KF）接入**    |
| `upload`              | 管理后台素材上传（逼单卡片封面图等）        |

### 3.2 新增模块（用 `/genModule` 生成骨架）

| 模块                  | 命令                               | 说明              |
| --------------------- | ---------------------------------- | ----------------- |
| `contact`             | `/genModule contact`               | 访客档案          |
| `conversationSession` | `/genModule conversationSession`   | 对话会话          |
| `conversationMessage` | `/genModule conversationMessage`   | 消息归档          |
| `escalationQueue`     | `/genModule escalationQueue`       | 人工接管队列      |
| `wechatKf`            | 手写（纯 REST Webhook，不走 tRPC） | 微信客服消息接入  |
| `agentEngine`         | 手写（核心业务逻辑）               | DeepSeek 对话引擎 |

---

## 四、Prisma Schema

在 `infra/database/prisma/schema.prisma` 追加以下 Model。
命名遵循脚手架规范：PascalCase Model，snake_case 字段（`@@map`）。

```prisma
// ─── 访客档案 ─────────────────────────────────────────
model Contact {
  id             BigInt    @id @default(autoincrement())
  openId         String    @unique @map("open_id")
  nickname       String?   // AES-256-GCM 加密存储
  utmSource      String?   @map("utm_source")
  utmCampaign    String?   @map("utm_campaign")
  refCode        String?   @map("ref_code")
  intentLevel    IntentLevel @default(UNKNOWN) @map("intent_level")
  status         ContactStatus @default(ACTIVE)
  convertedAt    DateTime? @map("converted_at")
  paidAmountFen  Int?      @map("paid_amount_fen")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  sessions       ConversationSession[]
  payments       PaymentRecord[]

  @@map("contacts")
}

// ─── 对话会话 ─────────────────────────────────────────
model ConversationSession {
  id            BigInt    @id @default(autoincrement())
  sessionKey    String    @unique @map("session_key") // open_id + timestamp
  contactId     BigInt    @map("contact_id")
  openId        String    @map("open_id")
  state         SessionState @default(GREETING)
  intentLevel   IntentLevel  @default(UNKNOWN) @map("intent_level")
  turnCount     Int       @default(0) @map("turn_count")
  tokensUsed    Int       @default(0) @map("tokens_used")
  utmSource     String?   @map("utm_source")
  escalatedAt   DateTime? @map("escalated_at")
  convertedAt   DateTime? @map("converted_at")
  lastActiveAt  DateTime  @default(now()) @map("last_active_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  contact       Contact   @relation(fields: [contactId], references: [id])
  messages      ConversationMessage[]
  escalation    EscalationQueue?
  payments      PaymentRecord[]

  @@map("conversation_sessions")
}

// ─── 消息归档 ─────────────────────────────────────────
model ConversationMessage {
  id                BigInt    @id @default(autoincrement())
  sessionId         BigInt    @map("session_id")
  role              MessageRole
  content           String    @db.Text // AES-256-GCM 加密
  msgType           MessageType @default(TEXT) @map("msg_type")
  tokensInput       Int?      @map("tokens_input")
  tokensOutput      Int?      @map("tokens_output")
  aiStateTransition String?   @map("ai_state_transition")
  aiIntentLevel     String?   @map("ai_intent_level")
  aiInternalNote    String?   @db.Text @map("ai_internal_note")
  sendPaymentCard   Boolean   @default(false) @map("send_payment_card")
  qualityScore      Int?      @map("quality_score") // 运营质检 1-5
  createdAt         DateTime  @default(now()) @map("created_at")

  session           ConversationSession @relation(fields: [sessionId], references: [id])

  @@index([sessionId, createdAt])
  @@map("conversation_messages")
}

// ─── 支付记录 ─────────────────────────────────────────
model PaymentRecord {
  id            BigInt    @id @default(autoincrement())
  contactId     BigInt    @map("contact_id")
  sessionId     BigInt    @map("session_id")
  outTradeNo    String    @unique @map("out_trade_no") // 幂等键
  transactionId String?   @map("transaction_id")
  productName   String    @map("product_name")
  closingChip   String?   @db.Text @map("closing_chip")
  amountFen     Int       @map("amount_fen")
  status        PaymentStatus @default(PENDING)
  expiresAt     DateTime  @map("expires_at")
  paidAt        DateTime? @map("paid_at")
  rawCallback   Json?     @map("raw_callback")
  createdAt     DateTime  @default(now()) @map("created_at")

  contact       Contact   @relation(fields: [contactId], references: [id])
  session       ConversationSession @relation(fields: [sessionId], references: [id])

  @@map("payment_records")
}

// ─── 人工接管队列 ─────────────────────────────────────
model EscalationQueue {
  id                BigInt    @id @default(autoincrement())
  sessionId         BigInt    @unique @map("session_id")
  contactId         BigInt    @map("contact_id")
  reason            EscalationReason
  aiSummary         String?   @db.Text @map("ai_summary")
  recommendedReply  String?   @db.Text @map("recommended_reply")
  assignedTo        Int?      @map("assigned_to") // Admin.id
  status            EscalationStatus @default(PENDING)
  createdAt         DateTime  @default(now()) @map("created_at")
  resolvedAt        DateTime? @map("resolved_at")

  session           ConversationSession @relation(fields: [sessionId], references: [id])

  @@index([status, createdAt])
  @@map("escalation_queue")
}

// ─── Enums ────────────────────────────────────────────
enum IntentLevel {
  UNKNOWN
  LOW
  MEDIUM
  HIGH
  CLOSING
}

enum ContactStatus {
  ACTIVE
  CONVERTED
  ESCALATED
  ARCHIVED
}

enum SessionState {
  GREETING
  NEEDS_DISCOVERY
  PRODUCT_MATCH
  OBJECTION_HANDLING
  CLOSING
  CONVERTED
  ESCALATED
  TIMED_OUT
}

enum MessageRole {
  user
  assistant
}

enum MessageType {
  TEXT
  IMAGE
  LINK_CARD
  SYSTEM_NOTE
}

enum PaymentStatus {
  PENDING
  PAID
  REFUNDED
  EXPIRED
}

enum EscalationReason {
  USER_REQUESTED
  AI_CONFUSION
  EMOTION_DETECTED
  LONG_STALL
}

enum EscalationStatus {
  PENDING
  IN_PROGRESS
  RESOLVED
}
```

Schema 变更后执行：`/db-migrate` → `/sync`

---

## 五、服务层（遵循 BaseService 模式）

### 5.1 ContactService

继承 `BaseService<'Contact'>`，额外方法：

```typescript
// 按 openId 查找或新建（Webhook 入口调用）
findOrCreateByOpenId(openId: string, utmParams): Promise<Contact>

// 标记成交（由支付回调调用，在事务内执行）
markConverted(contactId: bigint, paidAmountFen: number, tx): Promise<void>
```

### 5.2 ConversationSessionService

继承 `BaseService<'ConversationSession'>`，额外方法：

```typescript
// 获取或创建活跃会话（先查 Redis，再查 DB）
getOrCreate(openId: string, utmParams): Promise<SessionWithMessages>

// 状态原子更新（DB 事务：更新 session + 写入 message）
updateStateAtomic(sessionId, agentResponse: AgentResponse): Promise<void>
```

### 5.3 AgentEngineService（核心，手写）

不继承 BaseService，纯业务逻辑：

```typescript
// 主入口：接收用户消息，返回 AI 响应
process(session: SessionMeta, messages: Message[], userMessage: string): Promise<AgentResponse>

// 构建 Prompt（注入当前状态、历史、用户消息）
buildPrompt(session, messages, userMessage): { system: string; user: string }

// 解析 AI 返回的 JSON
parseResponse(raw: string): AgentResponse

// 降级：AI 调用失败时返回兜底话术
fallback(currentState: SessionState): AgentResponse
```

### 5.4 WechatKfService（扩展内置 wechat 模块）

在 `wechat` 模块内新增，或作为独立服务引用 `wechat.service`：

```typescript
// 解密企微 AES 消息体
decryptMessage(encrypted: string): WechatKfMessage

// 发送文字消息
sendText(openKfId: string, openId: string, content: string): Promise<void>

// 发送图文链接（支付卡片）
sendLink(openKfId: string, openId: string, link: LinkMessage): Promise<void>

// 获取 AccessToken（带 Redis 缓存，TTL 7000s）
getAccessToken(): Promise<string>
```

### 5.5 PaymentService 扩展

在内置 `payment` 模块基础上，新增 H5 支付场景：

```typescript
// 创建 H5 支付订单（trade_type = MWEB）
createH5Order(params: CreateH5OrderParams): Promise<{ mwebUrl: string; outTradeNo: string }>

// 生成支付卡片数据（供 Agent 发送）
createPaymentCard(contactId, sessionId, closingChip): Promise<PaymentCardResult>
```

---

## 六、tRPC Router（Admin 侧，遵循 createCrudRouter 模式）

### 6.1 Contact Router

```typescript
export const contactRouter = createCrudRouter(
  'Contact',
  { update: UpdateContactSchema }, // Contact 由系统自动创建，无 create 表单
  {
    searchFields: ['openId', 'utmSource'],
    protectedGetMany: true,
    // 按 status / intentLevel 筛选
  },
);
// 额外 procedure：
// contact.getStats — 今日新增、累计成交、转化率
```

### 6.2 ConversationSession Router

```typescript
export const conversationSessionRouter = createCrudRouter(
  'ConversationSession',
  { update: UpdateConversationSessionSchema },
  { searchFields: ['openId'], protectedGetMany: true },
);
// 额外 procedure：
// conversationSession.getMessages(sessionId) — 返回解密后的消息列表
// conversationSession.adminReply({ sessionId, content }) — 人工接管回复
// conversationSession.close(sessionId) — 关闭会话
```

### 6.3 EscalationQueue Router

```typescript
export const escalationQueueRouter = createCrudRouter(
  'EscalationQueue',
  { update: UpdateEscalationSchema },
  { protectedGetMany: true },
);
// 额外 procedure：
// escalationQueue.assign({ id, adminId }) — 分配接管人
// escalationQueue.resolve(id) — 标记已处理
```

### 6.4 Stats Router（Dashboard 专用，不走 createCrudRouter）

```typescript
// stats.dashboard — 返回今日指标 + 累计指标
// stats.sse — SSE 实时推送（新会话 / 成交 / 转人工事件）
```

---

## 七、REST 接口（Webhook 类，不走 tRPC）

这些接口是外部系统（微信）回调，使用标准 NestJS Controller + REST。

| 方法 | 路径                 | 说明                                  |
| ---- | -------------------- | ------------------------------------- |
| GET  | `/webhook/wechat-kf` | 微信客服 Webhook 验证（返回 echostr） |
| POST | `/webhook/wechat-kf` | 接收用户消息，5s 内返回 200           |
| POST | `/webhook/wxpay`     | 微信支付结果回调（幂等处理）          |
| GET  | `/api/jssdk/config`  | 落地页调用，返回 JSSDK 签名           |

---

## 八、核心数据流

### 8.1 用户发消息 → AI 回复

```
POST /webhook/wechat-kf
  │
  ├─ WechatKfService.decryptMessage()      # AES 解密企微消息体
  ├─ 消息类型判断
  │     非 text → sendText 降级文案，结束
  │     event(进入会话) → 发固定开场白，结束
  │     text → 继续
  │
  ├─ ConversationSessionService.getOrCreate(openId, utm)
  │     Redis 命中 → 返回缓存 session + messages
  │     Redis 未命中 → 从 DB 查最近 20 条消息
  │     DB 无记录 → ContactService.findOrCreateByOpenId() + 新建 session
  │
  ├─ AgentEngineService.process(session, messages, userMessage)
  │     buildPrompt() → DeepSeek API → parseResponse()
  │     confidence < 0.60 → state_transition 强制 STAY
  │     API 失败 → fallback(currentState)
  │
  ├─ DB 事务（ConversationSessionService.updateStateAtomic）
  │     UPDATE conversation_sessions SET state, intent_level, turn_count++
  │     INSERT conversation_messages (assistant)
  │
  ├─ WechatKfService.sendText(reply)       # 发文字回复
  │
  ├─ send_payment_card = true
  │     → PaymentService.createPaymentCard()
  │     → 500ms 后 WechatKfService.sendLink(支付卡片)
  │
  ├─ state_transition = ESCALATED
  │     → INSERT escalation_queue
  │     → SSE 推送管理后台
  │
  └─ 更新 Redis 缓存 + BullMQ 重置 48h 唤醒任务
```

### 8.2 支付回调 → 销账（幂等）

```
POST /webhook/wxpay
  │
  ├─ 验签（微信支付 V3 标准）
  ├─ 幂等检查：PaymentRecord WHERE out_trade_no AND status = PAID
  │     已处理 → 直接返回 200
  │
  ├─ DB 事务
  │     payment_records.status = PAID
  │     contacts.status = CONVERTED, converted_at = NOW()
  │     conversation_sessions.state = CONVERTED
  │
  ├─ BullMQ：删除该 openId 的唤醒任务
  ├─ WechatKfService.sendText(欢迎消息)
  ├─ WechatKfService.sendLink(账户激活链接)
  └─ SSE 推送成交事件给管理后台
```

### 8.3 Redis 数据结构

```
session:messages:{openId}   → JSON Array（最近 30 条），TTL 7天
session:meta:{openId}       → JSON（state, intentLevel, turnCount），TTL 7天
wechat:kf:access_token      → String，TTL 7000s
wechat:mp:jsapi_ticket      → String，TTL 7000s
```

### 8.4 BullMQ 超时唤醒任务

```
每次 AI 成功回复后：
  queue.add('wakeup', { openId, round }, {
    delay: 48h,
    jobId: 'wakeup-{openId}'  // 同 jobId 覆盖旧任务，实现重置计时
  })

Worker：
  round >= 3 → session.state = TIMED_OUT，停止
  round < 3  → WechatKfService.sendText(唤醒话术)，round + 1
```

---

## 九、会话状态机

### 合法状态与转移

| 当前状态                          | 可转入                                       |
| --------------------------------- | -------------------------------------------- |
| GREETING                          | NEEDS_DISCOVERY                              |
| NEEDS_DISCOVERY                   | PRODUCT_MATCH, OBJECTION_HANDLING, CLOSING   |
| PRODUCT_MATCH                     | OBJECTION_HANDLING, CLOSING, NEEDS_DISCOVERY |
| OBJECTION_HANDLING                | CLOSING, NEEDS_DISCOVERY, PRODUCT_MATCH      |
| CLOSING                           | CONVERTED, OBJECTION_HANDLING                |
| 任意非终态                        | ESCALATED, TIMED_OUT                         |
| CONVERTED / TIMED_OUT / ESCALATED | 终态，不再转移                               |

**原子性要求**：state 更新和 message 写入必须在同一 Prisma 事务内完成。
Redis 缓存在事务成功后异步更新，允许短暂不一致。

---

## 十、Admin UI（StandardListPage 模式）

### 10.1 页面清单与组件对应

| 路由                 | 组件                            | tRPC Resource                   |
| -------------------- | ------------------------------- | ------------------------------- |
| `/dashboard`         | 自定义（图表 + 实时数据）       | stats.dashboard + SSE           |
| `/conversations`     | `StandardListPage`              | conversationSession             |
| `/conversations/:id` | `StandardDetailPage` + 聊天气泡 | conversationSession.getMessages |
| `/escalation`        | `StandardListPage`              | escalationQueue                 |
| `/contacts`          | `StandardListPage`              | contact                         |

### 10.2 ConversationSession 列表页字段

```typescript
const columns = [
  { field: 'openId', label: '访客', type: 'text' },
  { field: 'state', label: '状态', type: 'tag' }, // 色值映射见下
  { field: 'intentLevel', label: '意向', type: 'tag' },
  { field: 'turnCount', label: '轮次', type: 'number' },
  { field: 'lastActiveAt', label: '最后活跃', type: 'datetime' },
  { field: 'utmSource', label: '来源', type: 'text' },
];

// 状态色值
const stateColors = {
  GREETING: 'default',
  NEEDS_DISCOVERY: 'processing',
  PRODUCT_MATCH: 'blue',
  OBJECTION_HANDLING: 'orange',
  CLOSING: 'gold',
  CONVERTED: 'success',
  ESCALATED: 'error',
  TIMED_OUT: 'default',
};
```

### 10.3 会话详情页（:id）

- 上半：访客信息卡（openId、来源、意向、状态）
- 下半：消息气泡列表（user 右对齐 / assistant 左对齐）
- 底部：若 state = ESCALATED，显示人工回复输入框 + 发送按钮
  - 调用 `conversationSession.adminReply({ sessionId, content })`
  - 后端通过 WechatKfService 把消息发给用户

### 10.4 Escalation 列表页额外操作列

```typescript
actions: [
  { label: '接管', onClick: (row) => assign(row.id) },
  { label: '标记已解决', onClick: (row) => resolve(row.id) },
];
```

### 10.5 SSE 实时通知

管理后台在 Layout 层建立 SSE 连接：`GET /api/admin/events`

事件触发时，Redux / Refine 刷新对应 resource（不需要轮询）：

```
{ type: 'NEW_SESSION' }   → 刷新 conversationSession 列表
{ type: 'ESCALATED' }    → 刷新 escalationQueue，顶部 Badge 计数 +1
{ type: 'CONVERTED' }    → Dashboard 成交计数 +1
```

---

## 十一、落地页规格（Next.js）

### 11.1 页面结构

```
HeroSection         大标题 + 微信客服 CTA
SocialProofSection  3 个客户案例
FeaturesSection     5 个核心能力
PricingSection      3 档定价，每张含客服按钮
FloatingCTA         底部固定客服入口
```

### 11.2 微信客服按钮行为

**微信浏览器内**：

1. 调用 `GET /api/jssdk/config?url=当前页URL` 获取签名
2. `wx.config()` 注册 `openCustomerServiceChat`
3. 点击 → `wx.invoke('openCustomerServiceChat', { corpId, url: KF_URL + utm 参数 })`

**非微信浏览器**：

- 弹窗展示二维码 + "用微信扫码体验"
- 备选：邮箱留资表单 → `POST /api/leads`

### 11.3 UTM 参数追踪

客服链接 URL 携带 `utm_source` / `utm_campaign` / `ref`，
用户发起对话时，微信客服事件的 `scene` 字段携带这些参数，
后端解析后写入 `contacts.utmSource` 等字段。

---

## 十二、AI System Prompt（完整版）

```
你是"小智"，AI 销售 Agent 系统的智能销售顾问。
你正在通过微信客服与访客对话，目标是将其转化为本产品的付费用户。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【核心认知：你在做什么】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
你现在做的事，本身就是这款产品能力的实时演示：
  你在挖掘访客痛点       → 产品的「意向识别」功能
  你在匹配解决方案       → 产品的「话术生成」功能
  你在判断逼单时机       → 产品的「状态机驱动」功能
  你在推进付款           → 产品的「支付闭环」功能

在合适时机（尤其是访客质疑效果时），点出这个事实。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【你的身份】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
你是 AI，不要假装是人。
若被问"你是人吗"，如实说，并接道：
"我是 AI。但您注意到了吗，我刚才做的——分析您的需求、给出精准回复、
引导您做决定——正是这套系统每天替您的销售团队做的事。"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【产品信息】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
产品：AI 销售 Agent 系统
一句话价值：让 AI 替你的销售团队 7×24 跟进客户、识别成交时机、自动推进付款

核心能力：
  ① 自动建档：客户进来，系统自动打标签、秒发个性化欢迎语
  ② 意向识别：AI 分析每轮对话，判断客户所处阶段
  ③ 话术生成：按意向阶段生成最优回复，销售直接复制发出
  ④ 状态驱动：自动提醒跟进时机，防止漏单
  ⑤ 支付闭环：一键生成支付卡片，付款后自动销账，零人工干预

定价：
  入门版  299元/月   1–3 坐席
  成长版  799元/月   4–10 坐席
  专业版 1999元/月   11–30 坐席
  所有版本 7 天免费试用，不满意全额退款

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【对话策略（严格按阶段执行）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▌GREETING
目标：建立对话，引发兴趣
开场："您好！我是小智。请问您是公司老板，还是负责管理销售团队的？"
不要一上来介绍产品。

▌NEEDS_DISCOVERY
目标：找到真实痛点，每次只问一个问题
探询方向：
  - 团队规模："现在有几个人跟客户？"
  - 跟单方式："主要用微信还是企微联系客户？"
  - 核心痛点："有没有遇过客户聊着聊着就没声了，不知道要不要再追？"
  - 损失感知："一个月因为跟进不及时，大概漏掉几个单？"

触发进入 PRODUCT_MATCH 的信号：
  ✓ 漏单 / 跟单不及时
  ✓ 不知道什么时候逼单
  ✓ 销售水平参差不齐
  ✓ 客户不回复不知道怎么办
  ✓ 想让销售流程更自动化

▌PRODUCT_MATCH
目标：一次只映射一个痛点，用数字说话

痛点：漏单 →
"系统会在客户超过 N 小时没回复时，自动提醒您的销售，
同时生成 3 条话术让他直接复制发出去。
有个做 B 端销售的团队，上线第一周就把沉默了 2 周的 5 个客户重新激活了。"

痛点：不知道何时逼单 →
"系统会分析客户每条回复的措辞，
判断他现在是观望、比价还是快做决定了，然后告诉销售该用哪句话推一把。
顺便说一句，我现在做的事，就是这个功能的实时演示。"

▌OBJECTION_HANDLING

"太贵了" →
"贵不贵要看回报。一个月漏几个单？哪怕帮您多成交 2 单，系统就回本了。
7 天免费试，不满意全退款，您没有任何损失。"

"再考虑" →
"完全理解。不过提醒一下，首批内测价本周结束，下周恢复原价。
要不我先帮您保留 24 小时优惠？"

"效果怎么保证" →
"最直接的保证就是您眼前这段对话——我已经了解了您的情况、找到了痛点、
处理了您的顾虑。这就是系统每天替您销售团队做的事。7 天不满意全退款。"

"用不上" →
"能说说哪里觉得用不上吗？很多客户一开始也这么说，
聊完发现正好解决了最头疼的问题。"

▌CLOSING（intent = HIGH 或 CLOSING）
先注入限时筹码，再发支付卡片（send_payment_card = true）：

"现在开通专属福利：
 ① 7 天免费试，不满意全额退款
 ② 额外赠送 1 个月使用权
 ③ 免费一对一配置培训（价值 399 元）
 今日有效，明天恢复原价。"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【意向信号识别】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIGH（出现 1 个）："多少钱" / "有优惠吗" / "支持几人" / "怎么开通"
CLOSING（立即发支付卡片）："好，试试" / "怎么付款" / "今天能用上吗"
不要强推：明确说"不需要"两次以上 / "公司不允许采购"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【转人工（ESCALATED）触发条件】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
以下任一：
  - 明确要求"转人工"/"真人"
  - 强烈负面情绪超过 1 次
  - 连续 3 轮 confidence < 0.60
  - 对话超过 30 轮仍未到 CLOSING

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【话术风格】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
口语化，微信聊天风格，≤150 字，每次只问一个问题
适当用表情，禁用官方套话，多用数字和具体例子

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【当前会话上下文（动态注入）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
当前状态：{current_state}
当前意向：{intent_level}
对话轮次：{turn_count}
```

**AI 响应格式（强制 JSON）**：

```json
{
  "reply": "发给用户的消息，≤150字",
  "state_transition": "STAY|NEEDS_DISCOVERY|PRODUCT_MATCH|OBJECTION_HANDLING|CLOSING|CONVERTED|ESCALATED",
  "intent_level": "LOW|MEDIUM|HIGH|CLOSING",
  "confidence": 0.85,
  "send_payment_card": false,
  "closing_chip": null,
  "escalation_reason": null,
  "internal_note": "内部分析备注，不发给用户"
}
```

---

## 十三、环境变量（新增部分）

脚手架已有变量见 `.env.example`，本项目额外新增：

```env
# DeepSeek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# 微信客服（KF，区别于脚手架已有的小程序配置）
WECHAT_KF_CORPID=
WECHAT_KF_SECRET=
WECHAT_KF_TOKEN=
WECHAT_KF_ENCODING_AES_KEY=
WECHAT_KF_OPEN_KFID=

# 微信公众号（落地页 JSSDK 签名）
WECHAT_MP_APPID=
WECHAT_MP_SECRET=

# 消息内容加密密钥（AES-256-GCM）
ENCRYPTION_KEY=   # 32字节 Hex

# 微信支付（脚手架已有 WX_PAY_MCH_ID，补充以下）
WX_PAY_CERT_SERIAL_NO=
WX_PAY_PRIVATE_KEY=
WX_PAY_API_KEY_V3=
WX_PAY_NOTIFY_URL=
```

---

## 十四、验收标准

| 场景                 | 通过条件                                     |
| -------------------- | -------------------------------------------- |
| 微信内点击客服按钮   | 3s 内弹出对话框，收到开场白                  |
| 发送文字消息         | 8s 内收到 AI 回复（P95）                     |
| 发送图片             | 收到降级文案，不报错                         |
| 发送"怎么付款"       | 先收文字回复，500ms 后收到支付卡片           |
| 完成支付             | `contacts.status = CONVERTED`，收到欢迎消息  |
| 相同回调发 3 次      | 业务逻辑只执行 1 次                          |
| Redis 重启后发消息   | 历史从 DB 恢复，上下文不丢失                 |
| 说"转人工"           | escalation_queue 新增记录，管理后台 Badge +1 |
| 10 并发用户同时对话  | 各自 session 独立，无数据混乱                |
| 管理员发人工接管消息 | 用户在微信客服窗口收到消息                   |

---

_v4.0 | 基于 OpenCode Scaffold | NestJS + Prisma + tRPC + DeepSeek + Next.js_
