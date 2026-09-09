# 销售 Copilot（企微侧边栏）PRD v1.0 + 实施修订

> **⚠️ 状态（2026-09-09）**：本文件已降级为**存档**。当前有效 PRD 为 `docs/prd.md` v2.0（整合了本文件的 R1-R6 修订与「引导加企微成员」功能）。本文件保留价值：① v1.0 原始 PRD 全文存档；② R1-R6 决策过程记录。

> 2026-09-08 定稿。方向拍板：产品形态从「全自动 AI 销售」调整为「**销售人员的 AI Copilot**」（企微侧边栏）+「会员积分留存终端」（小程序）。
> 本文件 = 原始 PRD v1.0 全文存档 + 实施修订记录。与 `docs/ROADMAP.md` 配套阅读：ROADMAP 管阶段与进度，本文件管产品定义与落地约束。

---

## 一、实施修订记录（2026-09-08 拍板）

原始 PRD 的五大模块保留为能力蓝图，落地时按以下修订执行：

### R1 会话上下文来源（最关键技术修正）

**企微不提供读取会话消息的 API**。原始 PRD 2.3「自动抓取当前聊天窗口最近 N 条对话记录」在标准企微接口下不可行——唯一官方通道是「会话内容存档」（付费、需员工逐个知情同意、有合规流程）。

| 会话场景           | V1 上下文来源                                        | 状态              |
| ------------------ | ---------------------------------------------------- | ----------------- |
| 微信客服（KF）会话 | 自有 DB：`ConversationMessage`（企微回调已全量入库） | ✅ V1 主战场      |
| 企微好友私聊       | 无对话上下文，AI 基于画像 + 最近行为生成             | ⏸ V2 评估会话存档 |

### R2 侧边栏载体收敛

V1 仅做**企微原生聊天工具栏**（企微管理后台「客户联系 → 聊天工具栏」配置自定义 H5 页面，覆盖桌面端与手机端）。页面内通过企业微信 JS-SDK：

- OAuth2 静默授权 → 企业成员身份（见 R5）
- `getCurExternalContact` → 当前会话客户的 `external_userid` → 后端查 `Contact`

Chrome 扩展移出 V1（维护成本高、企微桌面版兼容风险）。

### R3 发送原则：双轨制

- **KF 通道保留 AI 全自动接待**：客户在微信客服发的消息由 AI 自动回复。这是异步客服消息，不属于 PRD 排除项「社群全自动无人值守跟发」，已有资产不浪费。
- **侧边栏话术全部人工确认**：Copilot 只生成建议，销售复制后自行发送。侧边栏**不提供任何直接发送消息的能力**——硬编码约束，不做成可配置项（风控红线）。

### R4 数据模型对齐（替代 PRD 第 3 节草图）

现有资产（已存在，直接复用）：`User`（openid/unionid/phone，微信静默注册）、`Contact`（openId/unionId/utm 四件套/intentLevel/paidAmountFen）、`ConversationSession`/`ConversationMessage`（KF 会话全量入库）、`Product`/`Order`/`Address`（商城 + 支付）、Redis/BullMQ 基建。

| PRD 概念       | 落地模型                                                                                               | 变更     |
| -------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| OneID 身份归一 | `Contact.userId` 关联字段 + OneID 解析逻辑（phone / unionid / order_token 三路归一）                   | 新增关联 |
| 元数据自动打标 | `Contact.metadata Jsonb`（PRD 的结构化订单属性 JSON）                                                  | 扩展字段 |
| 积分余额       | `PointsLedger`（流水）+ `Contact.pointsBalance`（冗余余额，幂等入账）                                  | 新增     |
| 知识节点       | `KnowledgeNode`（nodeType: ENTITY/POLICY/RECO；检索一期 pgvector + 关键词双轨）                        | 新增     |
| Copilot 任务   | `CopilotTask`（contactId / assigneeId / taskType / status / payload / triggerAt）                      | 新增     |
| 兑换           | `Redemption` 或复用 `Order`（source=REDEMPTION）—— M5 设计时定                                         | 新增     |
| 人设/语气配置  | `Setting` 模型（替代 `LLM_SYSTEM_PROMPT_OVERRIDE` env），即 ROADMAP Phase 2 已规划的「运营配置 DB 化」 | 新增     |

- PRD 草图中的 `tenant_id` 不建（单实例售卖，无多租户）。
- 敏感字段（手机号）：PRD NFR 要求 AES-256 列级加密，现有明文字段迁移时一并处理；不向 LLM API 传明文手机号/姓名。

### R5 第三身份：企微员工（Member）

现有双用户体系（Admin JWT / User JWT）之外，侧边栏引入第三种身份：**企业成员**。

- 企微 OAuth2 code → 后端换 member userid → 校验「接待成员白名单」（存 `WecomConfig` 或新配置表）→ 签发短期 Member JWT（type=member）
- Member 只能读取客户画像与生成话术，无 Admin 数据面权限，不能访问管理端路由
- 数据隔离原则按此扩展为三类：Admin 全量 / User 仅自己 / Member 仅接待客户画像与话术

### R6 侧边栏前端载体

新建 `apps/sidebar`（Vite + React 轻量 H5，复用 `@opencode/shared` 类型）。不塞进 admin：Refine 登录体系与企微 OAuth 不同源，且侧边栏需要极致轻量（TTFT 预算紧）。

---

## 二、原始 PRD v1.0（存档）

> 以下为 2026-09-08 原始 PRD 全文照录。与 R1-R6 冲突处以修订记录为准。

## 1. 架构抽象与数据解耦设计

系统采用"底层抽象引擎 + 业务数据包（Data Package）"解耦架构。核心系统不硬编码任何特定行业的业务逻辑，所有行业属性（如品类特征、咨询类型、推荐规则、生命周期周期）均抽象为元数据 Schema、知识图谱与策略规则文件。

```
┌─────────────────────────────────────────────────────────────────┐
│                      系统核心引擎 (Engine)                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ 身份映射引擎 │ │ 知识/RAG引擎 │ │AI Copilot引擎│ │ 任务调度 │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                ▲
                                │ 动态加载 (JSON / Vector DB / Prompts)
┌─────────────────────────────────────────────────────────────────┐
│                     垂直行业数据包 (Data Pack)                    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │  属性Schema  │ │ 实体知识节点 │ │ 意图分类字典 │ │ 触达 SOP │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 核心模块与功能设计

### 2.1 流量接入与身份映射引擎 (Identity Resolution Engine)

- **渠道参数二维码/链接生成**：支持生成带有渠道标识（`channel_id`）、外部订单凭证（`order_token`）和归属标签（`tags`）的动态二维码与 H5/小程序链接。
- **跨平台身份归一 (ID Mapping)**：
  - **输入**：用户授权手机号、公域平台订单号（或加密 Hash）、微信 `UnionID`、企业微信 `ExternalUserID`。
  - **逻辑**：以手机号或加密订单凭证作为全局主键（`OneID`），自动关联用户在小程序与企业微信客服/私域好友中的身份。
- **元数据自动打标 (Metadata Tagging)**：基于接入的公域订单数据，自动生成结构化 JSON 属性存入用户画像库：

```json
{
  "first_sku_code": "SKU_10029",
  "category_hierarchy": ["Category_L1", "Category_L2"],
  "purchase_attributes": {
    "attr_key_1": "val_1",
    "attr_key_2": "val_2"
  },
  "order_amount": 299.0,
  "fulfilled_at": "2026-09-08T10:00:00Z"
}
```

### 2.2 知识与策略配置层 (Knowledge & Strategy Data Layer)

所有行业规则均通过后台控制台或文件配置导入：

- **RAG 向量知识库 (Knowledge Base)**：
  - **实体属性节点 (Entity Node)**：存储 SKU 详情、成分/规格、适用人群、禁忌项。
  - **客诉与解答 SOP (Policy Node)**：存储常见异议处理、售后退换货规则、安全使用标准。
  - **交叉推荐矩阵 (Cross-Sell Matrix)**：定义逻辑主线 `Primary_SKU_Attribute` → `Complementary_SKU_Code` 的推荐映射关系。
- **人设与语气引擎 (Persona Engine)**：
  - **系统 Prompt 模板**：配置 IP 人设名称、称呼偏好、语气基调、Emoji 使用密度、语言风格约束。
- **动态欢迎语拼装器**：依据用户关联的 `first_sku_code` 与属性标签，结合 IP 人设 Prompt，动态合成首条私域触达消息。

### 2.3 企微侧边栏 AI 销冠 Copilot

- **上下文聚合器 (Context Collector)**：
  - 自动抓取当前聊天窗口最近 $N$ 条对话记录。
  - 侧边栏读取并展示当前联系人的结构化画像（购买记录、活跃标签、积分余额、生命周期阶段）。
- **意图与抗拒识别器 (Intent Analyzer)**：
  - 识别用户当前提问的意图分类（如：`USAGE_CONSULTATION` 使用咨询、`OBJECTION_PRICE` 价格抗拒、`SAFETY_CONCERN` 安全顾虑、`COMPLAINT` 售后客诉）。
  - 萃取深层心理状态（如：焦虑度、价格敏感度、信任度）。
- **多策略回复生成器 (Multi-Strategy Generator)**：调用 RAG 知识库与用户画像，实时生成 3 个不同维度的候选回复：
  1. **策略 A（理性/科普型）**：侧重逻辑与专业解答。
  2. **策略 B（感性/逼单型）**：侧重情绪安抚、信任背书与限时权益诱导。
  3. **策略 C（搭售/升级型）**：结合关联推荐矩阵，生成交叉销售组合话术。
- **快捷动作面板 (Action Panel)**：
  - **一键复制**：将选中回复填入企微输入框。
  - **动态卡片生成**：一键生成绑定当前用户 ID 的专属兑换卡片/优惠券 H5 链接。

### 2.4 极简会员与兑换终端 (Mini-Program Loyalty Terminal)

- **轻量化移动端 (uni-app)**：
  - **身份认证**：微信一键授权手机号登录/绑定。
  - **凭证核销/积分入账**：输入订单号或扫码触发后端 API 校验，校验通过后向账户发放积分（`Points`）。
  - **权益兑换区**：支持 `纯积分兑换` 或 `积分 + 微额支付` 换购指定 SKU / 优惠券。
  - **私域引流节点**：在核销成功页与兑换成功页放置"企微获客助手"调用按钮，点击拉起半屏企微加好友。

### 2.5 周期性任务与触发器引擎 (Lifecycle Trigger Engine)

- **事件驱动规则集 (Event-Rule Engine)**：允许定义规则：`WHEN Event(Order_Fulfilled) IF Attributes.Lifecycle_Days > 0 THEN Schedule_Task(Offset_Days)`。
- **提醒任务生成 (Task Queue)**：当达到设定时间节点（如产品预计使用完毕前 $M$ 天），调度器在 Redis/BullMQ 生成待跟进 Task。
- **推送端**：在企微侧边栏 Copilot 的"待跟进任务"列表中置顶弹框，并自动附带 AI 生成的复购跟进话术。

## 3. 核心数据 Schema 设计 (Data Model)

```
+-------------------+       +-----------------------+       +---------------------+
|       User        |       |   Order_Verification  |       |   Knowledge_Node    |
+-------------------+       +-----------------------+       +---------------------+
| id (PK)           |1     N| id (PK)               |       | id (PK)             |
| union_id          |<------| user_id (FK)          |       | tenant_id           |
| external_user_id  |       | channel               |       | node_type (ENUM)    |
| phone_hash        |       | channel_order_id      |       | title               |
| points_balance    |       | sku_code              |       | content             |
| metadata (JSONB)  |       | verified_at           |       | embedding_vector    |
+-------------------+       +-----------------------+       | metadata (JSONB)    |
          |                                                 +---------------------+
          |1
          |                                                 +---------------------+
          |N                                                |    Copilot_Task     |
+-------------------+                                       +---------------------+
|     User_Tag      |                                       | id (PK)             |
+-------------------+                                       | user_id (FK)        |
| id (PK)           |                                       | operator_id         |
| user_id (FK)      |                                       | task_type (ENUM)    |
| tag_key           |                                       | status (ENUM)       |
| tag_value         |                                       | payload (JSONB)     |
+-------------------+                                       | trigger_at          |
                                                            +---------------------+
```

> 注：以上为原始草图，落地模型以 R4 映射表为准。

## 4. V1 边界与非功能性需求 (NFRs)

### 4.1 V1 包含与排除边界

- **In-Scope (包含)**：
  - 微信小程序（订单核销、积分查询、兑换）。
  - 企微获客助手接口对接与 ID 映射。
  - 企微侧边栏 AI Copilot（~~Chrome 扩展端移出 V1，见 R2~~；上下文获取、意图分析、3 种策略生成、一键复制）。
  - 基于 RAG 的 JSON/Markdown 格式知识库导入与检索。
  - 基础定时提醒任务（基于订单时间的 Offset 触发）。
- **Out-of-Scope (严格排除)**：
  - 企微社群全自动无人值守跟发机器人（降低风控风险）。
  - 多租户 SAAS 隔离体系（V1 为单租户/独占模式）。
  - 复杂的在线支付多方分账逻辑。
  - 对话式 BI 报表引擎。

### 4.2 非功能性需求 (NFRs)

- **延迟要求**：侧边栏点击"分析并生成回复"后，大模型首字返回时间（TTFT）$\le 1.5$ 秒，完整 3 套回复生成时间 $\le 4.0$ 秒。
- **数据安全与合规**：所有传输层使用 HTTPS；敏感字段（手机号、详细地址）在数据库层采用 AES-256 加密保存；不向大模型 API 传输客户明文手机号与真实姓名。
- **风控阻断**：AI 侧边栏生成的所有话术必须经过人工二次校验并手动点击"复制"，系统层严禁绕过人工直接向客户发送自动消息（实现约束见 R3）。

---

## 三、Phase 2 里程碑（索引）

详细任务分解与进度见 `docs/ROADMAP.md` 第四节：

- **M1 侧边栏壳**：`apps/sidebar` H5 + 企微 OAuth2 + `getCurExternalContact` + 画像只读页（端到端 spike，风险最高先做）
- **M2 AI 生成**：意图识别 + 3 策略流式生成 + 一键复制（TTFT ≤1.5s：流式 + 3 策略并行）
- **M3 知识库 RAG**：`KnowledgeNode` 模型 + admin CRUD + pgvector 检索注入 + Persona 配置 DB 化
- **M4 动态卡片**：专属兑换卡/优惠券链接生成（依赖 Phase 1 支付闭环）
- **M5/M6**（Phase 2.5）：积分终端、生命周期任务引擎
