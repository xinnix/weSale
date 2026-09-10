-- ============================================================
-- seed-mall.sql — 商城业务 mock 数据（Product / User / Address / Order）
--
-- 用途：本地开发与联调，为小程序商城（浏览/下单/支付）与 admin 仪表盘提供数据。
-- 幂等：固定主键 + ON CONFLICT DO NOTHING / WHERE NOT EXISTS，可重复执行。
-- 依赖：contacts/sessions 由 seed-kf.sql 创建，需先执行。
-- 执行：docker exec -i postgres psql -U xinnix -d wesale -v ON_ERROR_STOP=1 \
--        < infra/database/prisma/seed-mall.sql
-- ============================================================

-- ─── 商品 Product（6 ACTIVE + 1 DRAFT，覆盖商城首页与详情）───
INSERT INTO products (id, name, slug, description, short_description, cover_image,
                      category, price_fen, original_price_fen, billing_cycle, features,
                      status, sort, created_at, updated_at) VALUES
  ('mock_prod_0001', '冷萃拿铁礼盒装', 'cold-brew-latte-box',
   E'10 条鲜萃冷萃拿铁液 + 2 只陶瓷杯，100% 阿拉比卡豆。\n常温保存 9 个月，顺丰包邮，支持代写贺卡。',
   '鲜萃冷萃 10 条 + 陶瓷杯 ×2，顺丰包邮',
   'https://picsum.photos/seed/wesale-latte/600/600', '咖啡', 9900, 12800, 'ONE_TIME',
   '["10 条冷萃液","陶瓷杯 ×2","顺丰包邮","代写贺卡"]'::jsonb, 'ACTIVE', 1,
   now() - interval '30 days', now() - interval '5 days'),
  ('mock_prod_0002', '埃塞俄比亚耶加雪菲咖啡豆 250g', 'ethiopia-yirgacheffe-beans',
   E'耶加雪菲 G1 水洗豆，茉莉花香与柑橘酸质，中浅烘焙。\n下单后 48 小时内新鲜烘焙发货。',
   'G1 水洗 中浅烘 48h 内鲜焙',
   'https://picsum.photos/seed/wesale-beans/600/600', '咖啡', 6800, 7800, 'ONE_TIME',
   '["G1 等级","中浅烘焙","48h 鲜焙"]'::jsonb, 'ACTIVE', 2,
   now() - interval '30 days', now() - interval '5 days'),
  ('mock_prod_0003', '保温随行杯 450ml', 'travel-tumbler-450',
   E'316 不锈钢内胆，保温 6 小时 / 保冷 12 小时，自带茶滤。\n曜石黑 / 云雾白 / 松石绿三色可选。',
   '316 内胆 保温 6h 带 tea 滤',
   'https://picsum.photos/seed/wesale-tumbler/600/600', '器具', 8900, 9900, 'ONE_TIME',
   '["316 不锈钢","保温 6h","三色可选"]'::jsonb, 'ACTIVE', 3,
   now() - interval '30 days', now() - interval '5 days'),
  ('mock_prod_0004', '白瓷功夫茶具礼盒', 'ceramic-tea-set',
   E'一壶四杯白瓷功夫茶具，德化白瓷高温烧制。\n泡沫全包裹 + 运费险，破损包赔。',
   '德化白瓷 一壶四杯 破损包赔',
   'https://picsum.photos/seed/wesale-teaset/600/600', '茶具', 19900, 25900, 'ONE_TIME',
   '["德化白瓷","一壶四杯","运费险"]'::jsonb, 'ACTIVE', 4,
   now() - interval '30 days', now() - interval '5 days'),
  ('mock_prod_0005', '桂花乌龙茶 120g 罐装', 'osmanthus-oolong',
   E'秋摘乌龙窨制桂花，花香入骨不苦涩。\n独立密封罐，办公室冲泡友好。',
   '窨制桂花 办公室友好',
   'https://picsum.photos/seed/wesale-oolong/600/600', '茶', 4900, NULL, 'ONE_TIME',
   '["秋摘乌龙","密封罐装"]'::jsonb, 'ACTIVE', 5,
   now() - interval '30 days', now() - interval '5 days'),
  ('mock_prod_0006', '挂耳咖啡礼盒 30 片装', 'drip-coffee-bag-30',
   E'30 片混合装（耶加 / 曼特宁 / 蓝山风味各 10 片），一盒喝遍三种风味。',
   '30 片三种风味 混合装',
   'https://picsum.photos/seed/wesale-dripbag/600/600', '咖啡', 12900, 15900, 'ONE_TIME',
   '["30 片装","三种风味"]'::jsonb, 'ACTIVE', 6,
   now() - interval '30 days', now() - interval '5 days'),
  ('mock_prod_0007', '手冲壶套装（下架前勿购）', 'pour-over-set-draft',
   'DRAFT 状态样例：不会出现在商城列表（复用 /products/active 过滤验证）。',
   'DRAFT 样例商品',
   'https://picsum.photos/seed/wesale-pourover/600/600', '器具', 29900, NULL, 'ONE_TIME',
   '[]'::jsonb, 'DRAFT', 99,
   now() - interval '30 days', now() - interval '30 days')
ON CONFLICT (id) DO NOTHING;

-- ─── 小程序用户 User（微信静默注册形态，users 表无 openid 唯一索引，
--      幂等用 WHERE NOT EXISTS）────────────────────────────────
INSERT INTO users (id, username, openid, nickname, avatar, phone, "passwordHash",
                   "isActive", "createdAt", "updatedAt")
SELECT 'mock_user_0001', 'wx_woMockWxUser001', 'woMockWxUser001', '小明', NULL, '13800000001', '',
       true, now() - interval '20 days', now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE openid = 'woMockWxUser001');

INSERT INTO users (id, username, openid, nickname, avatar, phone, "passwordHash",
                   "isActive", "createdAt", "updatedAt")
SELECT 'mock_user_0002', 'wx_woMockWxUser002', 'woMockWxUser002', '小红', NULL, '13800000002', '',
       true, now() - interval '18 days', now() - interval '18 days'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE openid = 'woMockWxUser002');

INSERT INTO users (id, username, openid, nickname, avatar, phone, "passwordHash",
                   "isActive", "createdAt", "updatedAt")
SELECT 'mock_user_0003', 'wx_woMockWxUser003', 'woMockWxUser003', '小强', NULL, '13800000003', '',
       true, now() - interval '10 days', now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE openid = 'woMockWxUser003');

INSERT INTO users (id, username, openid, nickname, avatar, phone, "passwordHash",
                   "isActive", "createdAt", "updatedAt")
SELECT 'mock_user_0004', 'wx_woMockWxUser004', 'woMockWxUser004', '小白', NULL, '13800000004', '',
       true, now() - interval '5 days', now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE openid = 'woMockWxUser004');

-- ─── 收货地址 Address ────────────────────────────────────────
INSERT INTO addresses (id, user_id, receiver, phone, province, city, district, detail,
                       is_default, created_at, updated_at, "deletedAt") VALUES
  ('mock_addr_0001', 'mock_user_0001', '小明', '13800000001', '广东省', '深圳市', '南山区', '科技园南路 88 号 A 座 1201', true,  now() - interval '20 days', now() - interval '20 days', NULL),
  ('mock_addr_0002', 'mock_user_0001', '小明（公司）', '13800000001', '广东省', '深圳市', '南山区', '深圳湾科技生态园 9 栋 502', false, now() - interval '19 days', now() - interval '19 days', NULL),
  ('mock_addr_0003', 'mock_user_0002', '小红', '13800000002', '浙江省', '杭州市', '西湖区', '文三路 199 号创业大厦 803', true,  now() - interval '18 days', now() - interval '18 days', NULL),
  ('mock_addr_0004', 'mock_user_0003', '小强', '13800000003', '北京市', '北京市', '朝阳区', '望京 SOHO T3 2105', true,  now() - interval '10 days', now() - interval '10 days', NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── 订单 Order（12 单，覆盖状态 × 来源矩阵）─────────────────
-- MINIAPP PAID ×3（其一已发货 COMPLETED）
INSERT INTO orders (id, order_no, source, user_id, product_id, quantity,
                    unit_price_fen, total_amount_fen, status,
                    "addressSnapshot", paid_at, paid_transaction_id,
                    expire_at, created_at, updated_at) VALUES
  ('mock_order_0001', 'WS20260905MA0001', 'MINIAPP', 'mock_user_0001', 'mock_prod_0001', 1,
   9900, 9900, 'PAID',
   '{"receiver":"小明","phone":"13800000001","province":"广东省","city":"深圳市","district":"南山区","detail":"科技园南路 88 号 A 座 1201"}'::jsonb,
   now() - interval '4 days', 'mock_tx_minapp_0001', now() - interval '3 days' + interval '2 hours',
   now() - interval '4 days' - interval '10 minutes', now() - interval '4 days'),
  ('mock_order_0002', 'WS20260906MA0002', 'MINIAPP', 'mock_user_0002', 'mock_prod_0002', 2,
   6800, 13600, 'PAID',
   '{"receiver":"小红","phone":"13800000002","province":"浙江省","city":"杭州市","district":"西湖区","detail":"文三路 199 号创业大厦 803"}'::jsonb,
   now() - interval '3 days', 'mock_tx_minapp_0002', now() - interval '2 days' + interval '2 hours',
   now() - interval '3 days' - interval '15 minutes', now() - interval '3 days'),
  ('mock_order_0003', 'WS20260904MA0003', 'MINIAPP', 'mock_user_0001', 'mock_prod_0002', 1,
   6800, 6800, 'COMPLETED',
   '{"receiver":"小明","phone":"13800000001","province":"广东省","city":"深圳市","district":"南山区","detail":"科技园南路 88 号 A 座 1201"}'::jsonb,
   now() - interval '6 days', 'mock_tx_minapp_0003', now() - interval '5 days' + interval '2 hours',
   now() - interval '6 days' - interval '8 minutes', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- COMPLETED 单补发货信息（PAID→COMPLETED 走 shipOrder）
UPDATE orders SET ship_company = '顺丰速运', ship_no = 'SF0000000001', updated_at = now() - interval '2 days'
WHERE id = 'mock_order_0003' AND ship_no IS NULL;

-- MINIAPP PENDING ×2（待支付，未过期）
INSERT INTO orders (id, order_no, source, user_id, product_id, quantity,
                    unit_price_fen, total_amount_fen, status,
                    "addressSnapshot", expire_at, created_at, updated_at) VALUES
  ('mock_order_0004', 'WS20260909MA0004', 'MINIAPP', 'mock_user_0003', 'mock_prod_0003', 1,
   8900, 8900, 'PENDING',
   '{"receiver":"小强","phone":"13800000003","province":"北京市","city":"北京市","district":"朝阳区","detail":"望京 SOHO T3 2105"}'::jsonb,
   now() + interval '2 hours', now() - interval '20 minutes', now() - interval '20 minutes'),
  ('mock_order_0005', 'WS20260909MA0005', 'MINIAPP', 'mock_user_0003', 'mock_prod_0005', 3,
   4900, 14700, 'PENDING',
   '{"receiver":"小强","phone":"13800000003","province":"北京市","city":"北京市","district":"朝阳区","detail":"望京 SOHO T3 2105"}'::jsonb,
   now() + interval '2 hours', now() - interval '5 minutes', now() - interval '5 minutes')
ON CONFLICT (id) DO NOTHING;

-- KF_SESSION PAID ×2（客服转化单，contact 已在 seed-kf 中标记 CONVERTED）
INSERT INTO orders (id, order_no, source, contact_id, session_id, product_id, quantity,
                    unit_price_fen, total_amount_fen, status,
                    paid_at, paid_transaction_id, expire_at, metadata,
                    created_at, updated_at) VALUES
  ('mock_order_0006', 'WS20260907KF0001', 'KF_SESSION', 'mock_contact_0001', 'mock_session_0001', 'mock_prod_0001', 1,
   9900, 9900, 'PAID',
   now() - interval '2 days', 'mock_tx_kf_0001', now() - interval '1 days' + interval '2 hours',
   '{"channel":"wechat-kf","mock":true}'::jsonb,
   now() - interval '2 days' - interval '3 minutes', now() - interval '2 days'),
  ('mock_order_0007', 'WS20260906KF0002', 'KF_SESSION', 'mock_contact_0001', 'mock_session_0001', 'mock_prod_0002', 1,
   6800, 6800, 'PAID',
   now() - interval '3 days', 'mock_tx_kf_0002', now() - interval '2 days' + interval '2 hours',
   '{"channel":"wechat-kf","mock":true}'::jsonb,
   now() - interval '3 days' - interval '4 minutes', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- KF_SESSION PENDING ×2（无主单：卡片落地 / claim 场景联调用）
INSERT INTO orders (id, order_no, source, contact_id, session_id, product_id, quantity,
                    unit_price_fen, total_amount_fen, status,
                    expire_at, metadata, created_at, updated_at) VALUES
  ('mock_order_0008', 'WS20260909KF0003', 'KF_SESSION', 'mock_contact_0002', 'mock_session_0002', 'mock_prod_0003', 1,
   8900, 8900, 'PENDING',
   now() + interval '2 hours', '{"channel":"wechat-kf","mock":true}'::jsonb,
   now() - interval '1 hours', now() - interval '1 hours'),
  ('mock_order_0009', 'WS20260909KF0004', 'KF_SESSION', 'mock_contact_0003', 'mock_session_0003', 'mock_prod_0004', 1,
   19900, 19900, 'PENDING',
   now() + interval '2 hours', '{"channel":"wechat-kf","mock":true}'::jsonb,
   now() - interval '30 minutes', now() - interval '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- ADMIN_MANUAL COMPLETED ×1（后台代录 + 已发货）
INSERT INTO orders (id, order_no, source, user_id, product_id, quantity,
                    unit_price_fen, total_amount_fen, status,
                    "addressSnapshot", paid_at, paid_transaction_id,
                    ship_company, ship_no, created_by_id,
                    expire_at, created_at, updated_at) VALUES
  ('mock_order_0010', 'WS20260903AD0001', 'ADMIN_MANUAL', 'mock_user_0002', 'mock_prod_0004', 1,
   19900, 19900, 'COMPLETED',
   '{"receiver":"小红","phone":"13800000002","province":"浙江省","city":"杭州市","district":"西湖区","detail":"文三路 199 号创业大厦 803"}'::jsonb,
   now() - interval '7 days', 'mock_tx_admin_0001', '中通快递', 'ZT0000000002', NULL,
   now() - interval '6 days' + interval '2 hours',
   now() - interval '7 days' - interval '30 minutes', now() - interval '1 days')
ON CONFLICT (id) DO NOTHING;

-- MINIAPP REFUNDED ×1
INSERT INTO orders (id, order_no, source, user_id, product_id, quantity,
                    unit_price_fen, total_amount_fen, status,
                    "addressSnapshot", paid_at, paid_transaction_id,
                    refunded_at, refund_amount_fen, refund_reason,
                    expire_at, created_at, updated_at) VALUES
  ('mock_order_0011', 'WS20260902MA0011', 'MINIAPP', 'mock_user_0002', 'mock_prod_0006', 1,
   12900, 12900, 'REFUNDED',
   '{"receiver":"小红","phone":"13800000002","province":"浙江省","city":"杭州市","district":"西湖区","detail":"文三路 199 号创业大厦 803"}'::jsonb,
   now() - interval '8 days', 'mock_tx_minapp_0011',
   now() - interval '6 days', 12900, '不喜欢口味，七天无理由',
   now() - interval '7 days' + interval '2 hours',
   now() - interval '8 days' - interval '6 minutes', now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

-- MINIAPP CANCELLED ×1（超时未支付）
INSERT INTO orders (id, order_no, source, user_id, product_id, quantity,
                    unit_price_fen, total_amount_fen, status,
                    "addressSnapshot", expire_at, created_at, updated_at) VALUES
  ('mock_order_0012', 'WS20260901MA0012', 'MINIAPP', 'mock_user_0004', 'mock_prod_0005', 1,
   4900, 4900, 'CANCELLED',
   '{"receiver":"小白","phone":"13800000004","province":"上海市","city":"上海市","district":"徐汇区","detail":"漕溪北路 88 号 1802"}'::jsonb,
   now() - interval '9 days' + interval '2 hours',
   now() - interval '9 days' - interval '10 minutes', now() - interval '9 days')
ON CONFLICT (id) DO NOTHING;
