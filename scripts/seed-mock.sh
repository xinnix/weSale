#!/usr/bin/env bash
# ============================================================
# seed-mock.sh — 一键填充 mock 数据（幂等，可反复执行）
#
# 用法：
#   ./scripts/seed-mock.sh                    # 使用 .env 中的 DATABASE_URL 库名
#   POSTGRES_CONTAINER=pg DB_NAME=wesale ./scripts/seed-mock.sh
#
# 执行顺序（外键依赖决定）：
#   1. seed-base.sql  管理员/角色/权限（admin 登录用）
#   2. seed-kf.sql    微信客服链路：访客/会话/消息（Copilot 联调用）
#   3. seed-mall.sql  商城业务：商品/用户/地址/订单（商城与仪表盘用）
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${POSTGRES_CONTAINER:-postgres}"
DB_USER="${DB_USER:-xinnix}"

# 从根 .env 解析库名（postgresql://user:pass@host:port/dbname），可用 DB_NAME 覆盖
if [[ -z "${DB_NAME:-}" ]]; then
  DB_NAME="$(grep -m1 '^DATABASE_URL' .env 2>/dev/null | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
fi
DB_NAME="${DB_NAME:-wesale}"

SEED_DIR="infra/database/prisma"

echo "▶ 目标：容器=$CONTAINER 库=$DB_NAME 用户=$DB_USER"

# 前置检查：容器在跑、库存在
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "✗ PostgreSQL 容器 [$CONTAINER] 未运行，先执行: docker start $CONTAINER" >&2
  exit 1
fi
if ! docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "✗ 连接失败：库 [$DB_NAME] 不存在或凭证错误" >&2
  exit 1
fi

for f in seed-base.sql seed-kf.sql seed-mall.sql; do
  echo "▶ 执行 $SEED_DIR/$f"
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    --set=ON_ERROR_STOP=1 -q < "$SEED_DIR/$f"
done

echo "✅ mock 数据填充完成，当前数据量："
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F '  ' -c "
SELECT 'admins                ', COUNT(*) FROM admins
UNION ALL SELECT 'products              ', COUNT(*) FROM products
UNION ALL SELECT 'users                 ', COUNT(*) FROM users
UNION ALL SELECT 'addresses             ', COUNT(*) FROM addresses
UNION ALL SELECT 'orders                ', COUNT(*) FROM orders
UNION ALL SELECT 'contacts              ', COUNT(*) FROM contacts
UNION ALL SELECT 'conversation_sessions ', COUNT(*) FROM conversation_sessions
UNION ALL SELECT 'conversation_messages ', COUNT(*) FROM conversation_messages
ORDER BY 1;"
