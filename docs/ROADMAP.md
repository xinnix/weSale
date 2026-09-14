# weSale 转型计划与进度

> 最后更新：2026-09-14。本文档是项目路线图与进度台账。当前方向：**B2B 商家工具 · 人机协同形态**（微信客服 AI 全自动接待 + 企微侧边栏 AI Copilot + 会员积分留存），2026-09-08 由「全自动销售」修订而来，决策依据见文末附注，产品定义见 `docs/prd.md`（PRD v2.0，SSOT），演示链路对齐见 `docs/demo-blueprint.md`。

## 一、产品定位（转型后）

| 决策点   | 结论                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 产品定位 | **B2B 商家工具**：帮电商/私域商家卖他们自己的商品，按订阅收费                                                                        |
| 产品形态 | **人机协同**：微信客服（KF）保留 AI 全自动接待（双轨制）；侧边栏 Copilot 出话术/卡片建议，一键发送由销售在企微客户端内逐条确认（D9） |
| 租户形态 | **单实例售卖**：每商家一套部署，不做多租户 SaaS                                                                                      |
| 管理后台 | **admin 即商家端**，清除脚手架/平台运营痕迹                                                                                          |
| 支付路径 | **小程序 JSAPI 为唯一收款路径**（商家普遍无服务号，H5 收银/公众号 OAuth 已砍掉）                                                     |
| 商品形态 | **实物为主**：Address 模型与地址快照在 Phase 1 落地                                                                                  |
| 授权控制 | 暂不做 license，先靠合同约束                                                                                                         |

### 关键技术路线变化

KF 逼单转化从「发 H5 支付链接」改为「**AI 建单 → 发企微小程序卡片 → 顾客进小程序完成支付**」。所有支付收敛到小程序 JSAPI。风险项：企微客服发小程序卡片需实测验证（spike 脚本已备好：`apps/api/scripts/spike-kf-miniprogram.ts`）。

**2026-09-08 方向修订**：企微侧边栏 AI Copilot 确立为核心产品形态（PRD 与实施修订见 `docs/prd-copilot.md`）。关键约束：企微 API 无法读取会话消息，侧边栏上下文源 = 自有 DB 的 KF 会话记录（`ConversationMessage` 已全量入库）；企微好友私聊 V1 只给画像不给对话上下文。侧边栏载体 = 原生聊天工具栏 H5（JS-SDK `getCurExternalContact`），Chrome 扩展移出 V1。

## 二、总体路线

```
Phase 0    收尾提交（未提交变更验证+分组提交+CI基线修复）            ✅ 已完成
Phase 1    小程序商城 + 支付闭环 + 商家化基础                        🔨 进行中（Copilot 的地基，范围不变）
Phase 2    企微侧边栏 AI Copilot（壳→AI生成→知识库RAG→动态卡片）     🔨 进行中（M1+M2 已落地）
Phase 2.5  积分会员终端 + 生命周期任务引擎                            未开始
Phase 3    社群运营 + 会话存档评估（企微好友私聊上下文）              未开始（后移）
```

---

## 三、Phase 1 任务进度

### ✅ 已完成

| 任务                   | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 关键产物                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 0. 收尾提交            | 未提交的商品/订单变更验证、分组提交；CI 基线修复（lint error、miniapp 坏测试基建、prettier/eslint 风格战争终结）                                                                                                                                                                                                                                                                                                                                                                                                                | 4 组提交全推送，CI lint/test 转绿                                                    |
| 1.3 支付单位统一       | `wechat-pay` 的 `createOrder`/`refund` 直接收「分」，与 `Order.*Fen` 对齐                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `wechat-pay.service.ts`                                                              |
| 1.4 数据模型迁移       | `OrderSource` 枚举；`Order` 扩展 `source/userId/addressSnapshot/shipCompany/shipNo/expireAt`，`contactId` 放开可空；新增 `Address` 模型；`User.username/passwordHash` 放开可空（微信顾客静默注册）                                                                                                                                                                                                                                                                                                                              | 迁移 `20260908084247_add_order_source_address_user_nullable`                         |
| 1.4 共享层             | `CreateMiniappOrderSchema`/`ShipOrderSchema`/`Address` schemas、`order:ship` 权限                                                                                                                                                                                                                                                                                                                                                                                                                                               | `infra/shared/src/index.ts`                                                          |
| 1.4 订单号修复         | `WS+yyyyMMdd+6位随机`（去除易混淆字符），唯一冲突重试 ≤3，收敛为 OrderService 单一实现（删除 router 内联复制）                                                                                                                                                                                                                                                                                                                                                                                                                  | `order.service.ts`                                                                   |
| 1.6 支付编排           | `markPaidByOrderNo` 幂等事务：Order→PAID + Contact→CONVERTED + Session→CONVERTED 全链路同步；已 PAID 重复回调幂等返回                                                                                                                                                                                                                                                                                                                                                                                                           | `order.service.ts` + 3 个单元测试                                                    |
| 1.6 退款接线           | admin `refundOrder` 真调微信退款 API（fen 换算），API 失败自动回滚 REFUNDING 状态；退款回调 → `handleRefundCallback`                                                                                                                                                                                                                                                                                                                                                                                                            | `order.router.ts`                                                                    |
| 1.6 发货接口           | `shipOrder` procedure（`order:ship` 权限，PAID→COMPLETED，写 shipCompany/shipNo）                                                                                                                                                                                                                                                                                                                                                                                                                                               | `order.router.ts`                                                                    |
| DI 修复（部分）        | OrderService/WechatPayService 经 `main.ts` 注册进 tRPC 层（仿 `setPrismaService` 模式）                                                                                                                                                                                                                                                                                                                                                                                                                                         | `trpc.ts`/`main.ts`                                                                  |
| 1.9 Dashboard 接真数据 | 删除全部 Mock：接入 `order.getStats`（四统计卡）+ `order.getMany`（最近订单表）；假待办换成快捷入口                                                                                                                                                                                                                                                                                                                                                                                                                             | `DashboardPage.tsx`                                                                  |
| 1.2 admin 遗留摘除     | agents 模块（Dify 遗留）连根移除：菜单/路由/resource/页面文件（API 侧 Phase 2 删）                                                                                                                                                                                                                                                                                                                                                                                                                                              | `App.tsx`/`AdminLayout.tsx`                                                          |
| 1.1 品牌替换（第一波） | 侧边栏与页面 title：OpenCode → weSale 商家工作台                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `AdminLayout.tsx`/`index.html`                                                       |
| Spike 代码             | `uploadTempImage`（封面图→media_id）+ `sendMiniProgram`（小程序卡片，自动补 `.html` 后缀）+ 实测脚本                                                                                                                                                                                                                                                                                                                                                                                                                            | `kf-api.service.ts`/`wecom-api.service.ts`/`scripts/spike-kf-miniprogram.ts`         |
| 1.8 KF 逼单真实化      | 假支付链接下线：AI 意图 → 建 PENDING 单（source=KF_SESSION）→ 发真实小程序卡片（spike errcode=0）；入账复用 `markPaidByOrderNo` 幂等编排                                                                                                                                                                                                                                                                                                                                                                                        | `kf.service.ts`（c5c6891，2026-09-09 核对）                                          |
| 1.5 mall REST（后端）  | `/api/mall`：地址 CRUD（默认地址唯一、软删除、userId 数据隔离）+ 下单（委托 `createMiniappOrder`）+ 订单分页/详情 + JSAPI prepay；**支付回调闭环**：回调接 `markPaidByOrderNo`（金额不符拒入账）+ 退款回调接 `handleRefundCallback`；15 个单测                                                                                                                                                                                                                                                                                  | `modules/mall/`、`payment.controller.ts`、`order.service.ts`（2026-09-09）           |
| 1.2 DI 修复（另一半）  | wechat-kf/wecom router 模块级 `new` 移除，统一走 trpc setter 注册（`setWechatKfApiService`/`setWecomApiService` + main.ts 注入）                                                                                                                                                                                                                                                                                                                                                                                                | `trpc.ts`/`main.ts`/两个 router（2026-09-09）                                        |
| 回调可观测性           | 核对结论：无需修改——`handleCallbackAndSync` 内部已有 try/catch 错误日志（kf.service.ts:204），controller 侧 `.catch` 也在（kf.controller.ts:109）                                                                                                                                                                                                                                                                                                                                                                               | 2026-09-09 核对                                                                      |
| 1.7 小程序商城页面     | 商城首页（商品列表）/商品详情/订单确认/订单列表/支付结果/地址管理（列表+编辑）+ `src/api/mall.ts`；App.vue 微信静默登录（卡片落地前置，失败静默降级）；**KF 卡片落地页 `pages/order/confirm/index?orderNo=`**——配合后端新增领取端点 `POST /mall/orders/:orderNo/claim`（PENDING 无主单绑定当前用户，幂等）；11 个死页面注册清除（`pages.config.ts` 源头清理 + 删除脏 `pages.json` 重新生成，14 页全真实）；tsconfig 移除未安装的 `vitest-environment-uniapp/types`，业务代码 vue-tsc 归零（vite.config 栈深度为遗留依赖治理项） | `pages/`、`api/mall.ts`、`App.vue`、`pages.config.ts`、mall claim 端点（2026-09-09） |

### 🔨 进行中 / 待办

| 任务                   | 状态                       | 说明                                                                                                                                  |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Spike 实测**         | ✅ 已通过                  | 2026-09-08 实测：小程序卡片下发 errcode=0，点击卡片正常打开小程序，企微无需额外关联配置                                               |
| **1.5 / 1.2 / 1.7**    | ✅ 已完成                  | 2026-09-09 落地：mall REST + 支付闭环、DI 修复、小程序商城页面（含 KF 卡片落地页），详见已完成表                                      |
| 1.9 系统体检页         | 未开始（**当前最高优先**） | `system.router.ts`：企微/KF/支付/LLM 配置存在性检查 + admin 只读体检页                                                                |
| 1.10 部署文档          | 未开始                     | `.env.example` 重写（补 `LLM_*`/`MINIAPP_APPID`）；小程序 appid=mchid 绑定约束等                                                      |
| 1.1 品牌替换（第二波） | 未开始                     | 包名 `@opencode/*` → `@wesale/*`（5 个 package.json + 全局 import + pnpm install）；README/CLAUDE.md/AGENTS.md 重写（Phase 1 收尾做） |

> 排期逻辑（2026-09-09 更新）：1.5/1.2/1.7 已完成，Phase 1 主链（浏览 → 下单 → 支付 → KF 卡片落地）端到端打通；剩余 1.9/1.10/1.1 商家化收尾。Phase 1 完成后立即启动 Phase 2 M1（侧边栏壳 + F2/F8 引入层）。PRD v2.0 已定稿（2026-09-09），开放问题拍板结果见 `docs/prd.md` 第九节。

### 📌 数据库迁移策略（已落地）

- **CI 只保留质量关卡**：type-check / lint / test / security-audit / build-and-push（`migrate` job 已移除，不再需要 `PROD_DATABASE_URL` secret）
- **迁移在部署时执行**：容器 entrypoint（`apps/api/entrypoint-final.sh`）启动时自动 `prisma migrate deploy`——含 DB 连通预检（5s 快速失败）、三级 Prisma CLI 查找兜底；设 `SKIP_MIGRATION=true` 可跳过迁移
- CI 已全绿：type-check ✅ / lint ✅ / test ✅ / security-audit ✅

### 📌 本地调试环境（frp 隧道 + 企微 IP 白名单）

- **回调链路（微信→本地）已通**：`https://wesale.classmaster.cn/api/wechat-kf/callback` → openresty(111.229.4.238, TLS) → frps → frpc（本机 Docker 容器 `frpc`，配置 `~/code/frp/frpc.toml`）→ `host.docker.internal:3000`。实测：curl 探测的请求出现在本地 NestJS 日志中
- **60020 IP 白名单的真实边界（2026-09-08 实测确认）**：`kf/*` 专属 API（send_msg 等）**不受**可信 IP 校验；通用接口（`media/upload`）才校验。规避方式：封面图上传用自建应用 token（`uploadKfTempImage` 已带 kf→自建应用降级）。**无需在企微后台配置 IP**
- 支付回调复用同一域名（`WX_PAY_NOTIFY_URL=https://wesale.classmaster.cn/api/payments/wechat/callback`），端到端支付可在本地开发机验收
- **`.env` 修正记录**：`WX_WORK_KF_OPEN_KFID` 曾是脚手架占位符 `your-open-kfid`，已改为真实客服 ID（主进程不受影响，它从回调消息取 openKfId）
- **可观测性待办**：`handleCallbackAndSync` 的 sync 异常会被 fire-and-forget 吞掉（2026-09-08 17:18 实测静默失败一次），需补 try/catch 错误日志

---

## 四、Phase 2 规划：企微侧边栏 AI Copilot（方向已拍板）

产品定义见 `docs/prd.md`（PRD v2.0，SSOT；R1-R6 修订过程存档于 `docs/prd-copilot.md`）。核心约束回顾：上下文源 = 自有 DB 的 KF 会话记录（`ConversationMessage` 已入库）；侧边栏发送 = 销售在企微客户端内逐条手动确认的 `sendChatMessage`（D9，2026-09-09 拍板），严禁无人值守自动发送；Member 第三身份（企微员工 OAuth2）。

### ✅ M1 地基已落地（2026-09-13，代码侧；真联调待企微前置）

| 任务               | 内容                                                                                                                                                                                                        | 关键产物                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| schema 四件套      | `Contact` +`userId`(OneID)/`externalUserId`/`tags`/`pointsBalance`/`metadata`；`PointsLedger`（`idempotencyKey` 幂等）；`LiveCode` + `LiveCodeStatus`；`WecomConfig` +`memberUserids` 接待白名单（开放 #5） | 迁移 `20260913043607_...`                            |
| Member 第三身份    | 企微 OAuth2 静默授权 → 白名单校验 → 短期 Member JWT（type=member，2h，无 refresh）；**纯 REST** 新模块 `modules/sidebar/`，零 tRPC 侵入；`MemberJwtGuard` 与 Admin/User 身份面彻底隔离                      | `apps/api/src/modules/sidebar/`                      |
| 侧边栏 H5 壳       | `apps/sidebar`（Vite+React，gzip 64KB）；JS-SDK `ww.config`/`getCurExternalContact`/`sendChatMessage` 封装；画像面板（标签/统计/订单/会话/辅助建议，发送走人工确认）                                        | `apps/sidebar/`                                      |
| F3 OneID 订单归并  | 路径 A：`claimOrder` 反写 `Contact.userId`（仅空写，1:1 不覆盖）→ 画像聚合带出 User 完整订单历史（unionid/phone 归并后置）                                                                                  | `mall.service.ts`                                    |
| 语义标签引擎       | 行为标签实时推导（首购/复购/高客单价/沉睡/品类偏好）+ 渠道标签合并（`Contact.tags` 为 SSOT，企微原生 mark_tags 双写）                                                                                       | `sidebar-tags.service.ts`                            |
| F8 企微封装 + 归因 | `WecomApiService` externalcontact 族（getuserinfo/getExternalContact/mark_tag/add_contact_way/jsapi_ticket）；`change_external_contact` 回调归因分发（活码 state → Contact + autoTags 双写）                | `wecom-api.service.ts`/`external-contact.service.ts` |
| 验证               | 端到端画像 spike（复购/品类标签正确推导）；wecom-api 8 例 + mall OneID 2 例；api 90 tests 全过                                                                                                              | `scripts/spike-sidebar-*.ts`                         |

> **待真联调**（需企微后台配置）：OAuth 登录实测、`sendChatMessage` 三端、活码真实回调归因。前置：客户联系应用 secret / JS-SDK 可信域名 / OAuth 回调域名 / 网页应用+聊天工具栏。

### ✅ M2 已落地（2026-09-14，代码侧；LLM key 待更新）

| 任务           | 内容                                                                                                                    | 关键产物                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| schema         | `IntentCategory` 枚举（与 IntentLevel 强度正交）+ `CopilotStrategy` 枚举 + `SendEvent` 流水表（开放问题 #8）            | 迁移 `20260914023443_...`      |
| 意图与心理状态 | 独立非流式小调用 → `{category, psychology:{anxiety,priceSensitivity,trust}}`，先于策略返回                              | `copilot-llm.service.ts`       |
| 3 策略流式生成 | 纯文本流式（规避 json_object 拖垮 TTFT）+ 3 策略并行 + 单 SSE 多路复用（`strategy` 标签）；`req.on('close')` abort 上游 | `copilot-generate.service.ts`  |
| 端点           | `POST /api/sidebar/analyze`（SSE，MemberJwtGuard）+ `POST /api/sidebar/send/record`                                     | `sidebar-client.controller.ts` |
| 前端           | `useCopilotStream` + `CopilotPanel`（意图/心理状态 + 3 策略卡片 + 发送/复制）；发送成功上报采纳率                       | `apps/sidebar/src/`            |
| 验证           | SSE 事件序列实测（intent → 3 策略并行 → done）；发送落库；api 97 tests 全过                                             | —                              |

> **待配置**：`LLM_API_KEY` 已配但认证 401（无效），需更新后才能看到真实生成；真机 `sendChatMessage` 发送验证待企微前置。

| 里程碑        | 任务                                                                                                                                                                                                                                                          | 说明                                                                                                                       | 依赖             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| M1 侧边栏壳   | `apps/sidebar` H5 + 企微 OAuth2 + JS-SDK `getCurExternalContact` + `sendChatMessage` 发送 spike（text/小程序卡片，三端行为实测）+ 画像只读页 + Member JWT 第三身份 + F8 活码获客（admin：`add_contact_way` 活码管理 + state 归因 + 自动标签，可与侧边栏并行） | 端到端打通企微侧边栏整链路（风险最高，先做 spike）；含 `Contact.userId` 关联 + 画像聚合 API；活码与 F2 共用归因回调（D10） | 无               |
| M2 AI 生成    | 意图识别 + 3 策略流式生成 + 一键发送（`sendChatMessage`）+ 复制兜底 + 发送事件上报                                                                                                                                                                            | 基于 `ConversationMessage` 上下文；TTFT ≤1.5s（流式 + 3 策略并行）；发送流水存储见 PRD 开放问题 #8                         | M1               |
| M3 知识库 RAG | `KnowledgeNode` 模型 + admin CRUD + pgvector 检索注入 + `Setting` 配置 DB 化（Persona/欢迎语）                                                                                                                                                                | 替代 `LLM_SYSTEM_PROMPT_OVERRIDE` env；检索一期 pgvector + 关键词双轨                                                      | 可与 M1/M2 并行  |
| M4 动态卡片   | 专属兑换卡/优惠券链接生成 + `sendChatMessage` 小程序产品卡片                                                                                                                                                                                                  | 复用订单/支付；绑定 contactId 的一次性链接；miniprogram 卡片复用企微关联小程序配置                                         | Phase 1 支付闭环 |
| 顺手项        | agents/Dify 全删（API agents 模块 + Agent 模型）                                                                                                                                                                                                              | miniapp 重建后无引用                                                                                                       | 无               |

### Phase 2 验收标准

1. 侧边栏在企微聊天工具栏打开，正确显示当前客户画像（积分、标签、最近会话摘要）
2. 点击「分析」→ 3 策略流式生成，TTFT ≤1.5s、完整 ≤4s
3. 知识库条目可被检索并实际影响生成结果
4. **风控红线**：话术/产品卡片经 `sendChatMessage` 一键发送成功（销售在客户端内逐条确认）；系统中无任何绕过手动确认的静默/定时/批量自动发送逻辑（代码审查项）
5. Member 身份无法访问 admin 路由与数据面
6. F8 活码：物料扫码添加好友 → Contact 渠道来源 + 自动标签生效，侧边栏画像可见渠道来源

## 五、Phase 2.5 规划：积分会员终端 + 生命周期任务引擎

| 里程碑      | 任务                                                                                                                                 | 说明                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| M5 积分终端 | `PointsLedger` 流水 + `Contact.pointsBalance` + 核销 API（订单号/扫码）+ 兑换（纯积分 / 积分+微额支付）+ 核销/兑换成功页获客助手按钮 | PRD 2.4；兑换模型（独立 `Redemption` vs `Order.source=REDEMPTION`）M5 设计时定；手机号 AES-256 列级加密在此阶段一并落地 |
| M6 任务引擎 | `CopilotTask` 模型 + Offset 调度（BullMQ 已有）+ 侧边栏「待跟进」置顶 + AI 复购跟进话术                                              | PRD 2.5；规则形如 `WHEN Order_Fulfilled IF Lifecycle_Days > 0 THEN Schedule_Task(Offset_Days)`                          |
| 发货履约    | 小程序订单物流状态展示                                                                                                               | 原 Phase 2 遗留；更完整物流跟踪再评估第三方                                                                             |

## 六、Phase 3 规划：社群运营 + 私聊上下文

- **群聊销售**：企微「客户联系」API 族新集成面（新 group-sales 模块）；@提及触发 AI；前置企微 API 权限与合规调研
- **定时推送**：`PushTask` 模型 + 调度 + 限速发送 + admin 页；依赖 unionid 定向
- **朋友圈辅助**：MomentDraft 内容库 + LLM 生成辅助，一期只做内容辅助
- **会话存档评估**：企微好友私聊的对话上下文（`prd-copilot.md` R1 的 V2 项）——付费会话内容存档 + 员工授权 + 合规流程，出评估结论再排期
- **对话质检**：ConversationSession 加 qc 字段；夜间 LLM-as-judge 抽检 + admin 质检页（原 Phase 2 后移）
- **销售漏斗**：LandingPageView → Session 状态 → sendPaymentCard → Order PAID 聚合，dashboard 漏斗图（原 Phase 2 后移）
- **补 PRD 遗留**：EscalationQueue + 队列页；PENDING 订单超时关单（expireAt 已埋）；会话超时提醒

---

## 七、Phase 1 验收标准（对照用）

1. **小程序自主购买**：微信登录 → 商品列表 → 详情 → 选地址下单 → JSAPI 支付 → 订单 PAID
2. **AI 逼单转化**：客服会话说"怎么买" → AI 建 PENDING 单 + 发小程序卡片 → 小程序内支付 → Order PAID + Contact CONVERTED + session CONVERTED + 确认文案
3. **幂等**：回调重放 3 次状态只变一次且均 ACK；金额不符回调拒入账有告警
4. **退款闭环**：admin 发起退款 → 微信退款成功 → REFUNDED、paidAmountFen 扣减
5. **并发**：并发建 50 单无 orderNo 重复（✅ 单元测试已覆盖）
6. **Dashboard**：admin 首页显示 DB 真实聚合（✅ 已完成）
7. **商家化**：`grep -r opencode apps/ infra/` 仅剩 lock 文件；体检页显示配置状态
8. 小程序 `pages.json` 无死页面；`pnpm type-check`、`/build-all` 通过

---

## 附：关键背景

- **2026-09-14 M2 落地**：侧边栏 AI Copilot 生成——意图分类 + 心理状态 + 3 策略并行流式（纯文本保 TTFT，单 SSE 多路复用 `strategy` 标签）+ 前端流式面板 + 发送上报采纳率。新增 `IntentCategory`/`CopilotStrategy` 枚举 + `SendEvent` 流水表（开放问题 #8）。端到端 SSE 实测通过（intent → 3 策略并行 → done）；`LLM_API_KEY` 已配但认证 401，需更新。
- **2026-09-13 演示蓝本 + M1 地基落地**：与产品对齐端到端演示蓝本（`docs/demo-blueprint.md`），拍板四项决策：双路径获客 / 扫码注册即送积分 / 侧边栏含 M2 AI 生成 / 真联调企微。M1 代码侧落地：schema 四件套 + Member 第三身份（纯 REST）+ `apps/sidebar` H5 壳 + **OneID 订单归并（路径 A：`claimOrder` 反写 `Contact.userId`）** + 语义标签引擎 + 企微 externalcontact 封装与回调归因。**核心命题：打通 OneID 能看到顾客完整订单历史，语义标签才准确**；unionid/phone 归并后置。真联调待企微后台前置。
- **2026-09-08 方向修订（Copilot pivot）**：产品形态从全自动销售调整为「销售 Copilot（企微侧边栏）+ 会员积分留存」。三项拍板决策：① KF 自动接待保留（双轨制），侧边栏话术全部人工确认；② V1 仅企微原生侧边栏，Chrome 扩展移出；③ 企微 API 无法读取会话消息，侧边栏上下文源 = 自有 DB 的 KF 会话记录。完整修订记录（R1-R6）见 `docs/prd-copilot.md`
- **2026-09-09 发送红线修订（D9）**：侧边栏放开「一键直接发送」——话术 text + 产品 miniprogram 卡片走企微官方 `sendChatMessage`（销售在企微客户端内逐条手动确认，PC 端需再点发送；非无人值守）；一键复制降级为兜底。P1 红线改写为「严禁静默/定时/批量自动发送」，依据见 `docs/prd.md` D4/D9
- **2026-09-09 引入路径补充（F8/D10）**：企微好友引入 = KF 会话引导（F2）+ 活码扫码（F8，admin 生成带 state 渠道参数的「联系我」码，投放包裹卡/门店/广告）双路径，共用归因回调按 state 分流；自动打标签双写（企微原生 mark_tags + `Contact.tags`）。见 `docs/prd.md` D10/F8
- 原 PRD（`docs/prd.md`，"产品卖自己"）与实施计划（`docs/implementation-plan.md` v5.1）描述的是转型前的自营定位；本文件取代其方向性内容
- 枚举规范以 `infra/database/CLAUDE.md` 为准（**Prisma enum + `/enum-sync`**），根 CLAUDE.md 的"无 enum"描述已过时
- 已知遗留：miniapp vite 7/5 双版本类型冲突（type-check 报 excessive stack depth）——Phase 1 依赖治理时统一
- 商家部署约束：`WX_PAY_APP_ID` 必须等于小程序 appid；`MINIAPP_APPID` 供企微发卡片使用
