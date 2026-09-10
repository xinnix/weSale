# Seed Data Skill

快速创建数据库假数据用于开发和测试。

## 概述

项目使用纯 SQL 脚本创建假数据（Prisma 7.x adapter 兼容性问题，绕开 `prisma db seed`）。
**统一入口是根目录脚本 `scripts/seed-mock.sh`**，按外键依赖顺序执行三份幂等 SQL。

## 执行命令

```bash
./scripts/seed-mock.sh          # 推荐：一键填充全部 mock 数据
# 环境变量可覆盖：POSTGRES_CONTAINER / DB_NAME / DB_USER
```

或使用 `/seed-data` 触发本 skill，按「执行流程」操作。

## 执行流程

1. **检查环境**：验证 PostgreSQL 容器是否运行（默认容器名 `postgres`）
2. **按序执行三份脚本**（外键依赖决定顺序，不可调换）：
   - `seed-base.sql` → 管理员/角色/权限（admin 登录用）
   - `seed-kf.sql` → 微信客服链路：访客/会话/消息（Copilot/侧边栏联调用）
   - `seed-mall.sql` → 商城业务：商品/用户/地址/订单（商城 + 仪表盘用）
3. **验证结果**：脚本末尾自动打印各表数量

## mock 数据目录（2026-09-09 对齐 weSale 当前 schema）

### seed-base.sql — 管理端

- 3 个管理员：superadmin / admin / viewer @example.com，密码 `password123`
- 3 角色 + 16 权限 + 关联；2 个邮箱注册测试用户（u1/u2）

### seed-kf.sql — 微信客服链路（PRD F1/F4 联调用）

- 4 位访客（`mock_contact_0001..0004`）：1 位已转化（CONVERTED + paid_amount_fen）、1 位已发卡待付、1 位送礼咨询中、1 位闲逛
- 4 个会话（session_key 幂等）：CONVERTED / CLOSING / PRODUCT_MATCH / NEEDS_DISCOVERY 各一
- 21 条消息（kf_msg_id 幂等）：含价格异议处理、`send_payment_card` 逼单卡片、SYSTEM_NOTE 转化记录等真实销售对话

### seed-mall.sql — 商城业务

- 7 个商品（`mock_prod_0001..0007`）：6 ACTIVE（咖啡/茶/器具，含划线价）+ 1 DRAFT（验证列表过滤）
- 4 个小程序用户（`mock_user_0001..0004`，openid 静默注册形态）
- 4 个收货地址（默认地址唯一）
- 12 个订单（`mock_order_0001..0012`）：状态 × 来源矩阵——
  MINIAPP（PAID×3 含已发货 COMPLETED、PENDING×2、REFUNDED、CANCELLED）+ KF_SESSION（PAID×2、PENDING 无主单×2 供 claim/卡片落地联调）+ ADMIN_MANUAL（COMPLETED 含运单）

## 幂等性说明（可反复执行）

- 固定主键（`mock_` 前缀）+ `ON CONFLICT DO NOTHING`
- `users` 表**没有 email 唯一约束**（唯一键：username/openid/unionid）——mock 用户用 `WHERE NOT EXISTS (openid)`，seed-base 用 `ON CONFLICT (id)`
- 会话按 `session_key`、消息按 `kf_msg_id` 冲突跳过；重复执行数量不变
- mock 数据与真实 KF 回调数据并存互不干扰（真实数据 open_kf_id/session_key 不同）

## 测试账号

- 管理端：`superadmin@example.com` / `password123`
- 小程序：微信静默登录（真实 code2Session），mock 用户仅用于数据关联，不能直接登录

## 手动执行（可选）

```bash
docker exec -i postgres psql -U xinnix -d wesale -v ON_ERROR_STOP=1 < infra/database/prisma/seed-kf.sql
docker exec -i postgres psql -U xinnix -d wesale -v ON_ERROR_STOP=1 < infra/database/prisma/seed-mall.sql
```

## 注意事项

1. **顺序**：seed-kf 在 seed-mall 之前（orders 外键引用 contacts/sessions）
2. **生产环境**：⚠️ 切勿在生产执行（脚本无环境判断）
3. **商品封面图**：mock 用 picsum.photos 占位，小程序真机调试需在微信后台加 downloadFile 合法域名，或换成自有图床
4. **新建业务 mock**：继续加进对应 SQL 文件并保持 `mock_` 前缀 + 幂等约定，不要另起脚本

## 故障排查

```bash
# 容器未运行
docker start postgres

# 库不存在（默认库名取自根 .env 的 DATABASE_URL，当前为 wesale）
docker exec -i postgres psql -U xinnix -c "CREATE DATABASE wesale;"

# 表不存在 → 先跑迁移（或启动 API 容器自动 migrate deploy）
pnpm --filter @opencode/database exec prisma migrate deploy
```
