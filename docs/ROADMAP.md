# weSale 转型计划与进度

> 最后更新：2026-09-08。本文档是项目从「自营 AI 销售 MVP」转型为「B2B 商家工具」的总路线图与进度台账，决策依据见文末附注。

## 一、产品定位（转型后）

| 决策点   | 结论                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 产品定位 | **B2B 商家工具**：帮电商/私域商家卖他们自己的商品，按订阅收费                    |
| 租户形态 | **单实例售卖**：每商家一套部署，不做多租户 SaaS                                  |
| 管理后台 | **admin 即商家端**，清除脚手架/平台运营痕迹                                      |
| 支付路径 | **小程序 JSAPI 为唯一收款路径**（商家普遍无服务号，H5 收银/公众号 OAuth 已砍掉） |
| 商品形态 | **实物为主**：Address 模型与地址快照在 Phase 1 落地                              |
| 授权控制 | 暂不做 license，先靠合同约束                                                     |

### 关键技术路线变化

KF 逼单转化从「发 H5 支付链接」改为「**AI 建单 → 发企微小程序卡片 → 顾客进小程序完成支付**」。所有支付收敛到小程序 JSAPI。风险项：企微客服发小程序卡片需实测验证（spike 脚本已备好：`apps/api/scripts/spike-kf-miniprogram.ts`）。

## 二、总体路线

```
Phase 0  收尾提交（未提交变更验证+分组提交+CI基线修复）     ✅ 已完成
Phase 1  小程序商城 + 支付闭环 + 商家化基础               🔨 进行中
Phase 2  AI 能力升级（知识库/配置DB化/质检/漏斗）           未开始
Phase 3  社群运营（群聊/定时推送/朋友圈辅助）              未开始
```

---

## 三、Phase 1 任务进度

### ✅ 已完成

| 任务                   | 内容                                                                                                                                                                                               | 关键产物                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0. 收尾提交            | 未提交的商品/订单变更验证、分组提交；CI 基线修复（lint error、miniapp 坏测试基建、prettier/eslint 风格战争终结）                                                                                   | 4 组提交全推送，CI lint/test 转绿                                            |
| 1.3 支付单位统一       | `wechat-pay` 的 `createOrder`/`refund` 直接收「分」，与 `Order.*Fen` 对齐                                                                                                                          | `wechat-pay.service.ts`                                                      |
| 1.4 数据模型迁移       | `OrderSource` 枚举；`Order` 扩展 `source/userId/addressSnapshot/shipCompany/shipNo/expireAt`，`contactId` 放开可空；新增 `Address` 模型；`User.username/passwordHash` 放开可空（微信顾客静默注册） | 迁移 `20260908084247_add_order_source_address_user_nullable`                 |
| 1.4 共享层             | `CreateMiniappOrderSchema`/`ShipOrderSchema`/`Address` schemas、`order:ship` 权限                                                                                                                  | `infra/shared/src/index.ts`                                                  |
| 1.4 订单号修复         | `WS+yyyyMMdd+6位随机`（去除易混淆字符），唯一冲突重试 ≤3，收敛为 OrderService 单一实现（删除 router 内联复制）                                                                                     | `order.service.ts`                                                           |
| 1.6 支付编排           | `markPaidByOrderNo` 幂等事务：Order→PAID + Contact→CONVERTED + Session→CONVERTED 全链路同步；已 PAID 重复回调幂等返回                                                                              | `order.service.ts` + 3 个单元测试                                            |
| 1.6 退款接线           | admin `refundOrder` 真调微信退款 API（fen 换算），API 失败自动回滚 REFUNDING 状态；退款回调 → `handleRefundCallback`                                                                               | `order.router.ts`                                                            |
| 1.6 发货接口           | `shipOrder` procedure（`order:ship` 权限，PAID→COMPLETED，写 shipCompany/shipNo）                                                                                                                  | `order.router.ts`                                                            |
| DI 修复（部分）        | OrderService/WechatPayService 经 `main.ts` 注册进 tRPC 层（仿 `setPrismaService` 模式）                                                                                                            | `trpc.ts`/`main.ts`                                                          |
| 1.9 Dashboard 接真数据 | 删除全部 Mock：接入 `order.getStats`（四统计卡）+ `order.getMany`（最近订单表）；假待办换成快捷入口                                                                                                | `DashboardPage.tsx`                                                          |
| 1.2 admin 遗留摘除     | agents 模块（Dify 遗留）连根移除：菜单/路由/resource/页面文件（API 侧 Phase 2 删）                                                                                                                 | `App.tsx`/`AdminLayout.tsx`                                                  |
| 1.1 品牌替换（第一波） | 侧边栏与页面 title：OpenCode → weSale 商家工作台                                                                                                                                                   | `AdminLayout.tsx`/`index.html`                                               |
| Spike 代码             | `uploadTempImage`（封面图→media_id）+ `sendMiniProgram`（小程序卡片，自动补 `.html` 后缀）+ 实测脚本                                                                                               | `kf-api.service.ts`/`wecom-api.service.ts`/`scripts/spike-kf-miniprogram.ts` |

### 🔨 进行中 / 待办

| 任务                   | 状态      | 说明                                                                                                                                    |
| ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Spike 实测**         | ✅ 已通过 | 2026-09-08 实测：小程序卡片下发 errcode=0，点击卡片正常打开小程序，企微无需额外关联配置                                                 |
| 1.5 用户端商城 REST    | 未开始    | `mall` 模块：商品列表/详情（复用 `/products/active`）、下单（地址快照）、我的订单、prepay、地址 CRUD                                    |
| 1.7 小程序商城页面     | 未开始    | mall/商品详情/订单确认（含地址）/支付结果/订单列表/订单管理页 + 地址管理；**同时清理 11 个死页面注册**（当前 miniapp build 失败的根因） |
| 1.8 KF 逼单真实化      | 未开始    | `kf.service.ts:510-521` 假链接替换：AI 建单（source=KF_SESSION）→ 发小程序卡片（依赖 spike 验证）                                       |
| 1.9 系统体检页         | 未开始    | `system.router.ts`：企微/KF/支付/LLM 配置存在性检查 + admin 只读体检页                                                                  |
| 1.10 部署文档          | 未开始    | `.env.example` 重写（补 `LLM_*`/`MINIAPP_APPID`）；小程序 appid=mchid 绑定约束等                                                        |
| 1.1 品牌替换（第二波） | 未开始    | 包名 `@opencode/*` → `@wesale/*`（5 个 package.json + 全局 import + pnpm install）；README/CLAUDE.md/AGENTS.md 重写                     |
| 1.2 DI 修复（另一半）  | 未开始    | `wechat-kf.router.ts`/`wecom.router.ts` 仍模块级 `new` 服务（Redis 静默降级），注册模式已建立待推广                                     |

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

## 四、Phase 2 方向性规划（AI 能力升级 + 完整履约）

- **发货履约补全**：小程序订单物流状态展示；需要更完整物流跟踪再评估第三方
- **话术知识库**：`KnowledgeEntry` 模型 + admin CRUD 页；`buildSystemPrompt` 注入检索结果（一期关键词匹配，预留 pgvector）
- **运营配置 DB 化**：`Setting` 模型（店铺名/logo/欢迎语/AI prompt 模板）+ 商家设置页，替代 `LLM_SYSTEM_PROMPT_OVERRIDE` env
- **对话质检**：ConversationSession 加 qc 字段；`@nestjs/schedule` 夜间 LLM-as-judge 抽检 + admin 质检页
- **销售漏斗**：LandingPageView → Session 状态 → sendPaymentCard → Order PAID 聚合，dashboard 漏斗图
- **补 PRD 遗留**：EscalationQueue + 队列页；PENDING 订单超时关单（expireAt 已埋）；会话超时提醒
- **agents/Dify 全删**：API agents 模块 + Agent 模型（miniapp 重建后无引用）

## 五、Phase 3 方向性规划（社群运营）

- **群聊销售**：企微「客户联系」API 族新集成面（新 group-sales 模块）；@提及触发 AI；前置企微 API 权限与合规调研
- **定时推送**：`PushTask` 模型 + 调度 + 限速发送 + admin 页；依赖 unionid 定向
- **朋友圈辅助**：MomentDraft 内容库 + LLM 生成辅助，一期只做内容辅助

---

## 六、Phase 1 验收标准（对照用）

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

- 原 PRD（`docs/prd.md`，"产品卖自己"）与实施计划（`docs/implementation-plan.md` v5.1）描述的是转型前的自营定位；本文件取代其方向性内容
- 枚举规范以 `infra/database/CLAUDE.md` 为准（**Prisma enum + `/enum-sync`**），根 CLAUDE.md 的"无 enum"描述已过时
- 已知遗留：miniapp vite 7/5 双版本类型冲突（type-check 报 excessive stack depth）——Phase 1 依赖治理时统一
- 商家部署约束：`WX_PAY_APP_ID` 必须等于小程序 appid；`MINIAPP_APPID` 供企微发卡片使用
