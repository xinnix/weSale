-- ============================================================
-- seed-kf.sql — 微信客服链路 mock 数据（Contact / Session / Message）
--
-- 用途：本地开发与联调，为 Copilot/侧边栏（PRD F4）提供会话上下文数据。
-- 幂等：固定主键 + ON CONFLICT DO NOTHING，可重复执行。
-- 依赖：无（被 seed-mall.sql 的订单引用 contacts/sessions，需先执行本文件）。
-- 执行：docker exec -i postgres psql -U xinnix -d wesale -v ON_ERROR_STOP=1 \
--        < infra/database/prisma/seed-kf.sql
-- ============================================================

-- ─── 访客 Contact（4 位）────────────────────────────────────
INSERT INTO contacts (id, open_id, nickname, phone, status, intent_level,
                      utm_source, utm_medium, utm_campaign,
                      first_active_at, last_active_at, converted_at, paid_amount_fen,
                      created_at, updated_at) VALUES
  ('mock_contact_0001', 'woMockExternal001', '王女士', '13900000001', 'CONVERTED', 'CLOSING',
   'kf', 'wechat-kf', 'mock-seed',
   now() - interval '3 days', now() - interval '2 days', now() - interval '2 days', 9900,
   now() - interval '3 days', now() - interval '2 days'),
  ('mock_contact_0002', 'woMockExternal002', '刘先生', '13900000002', 'ACTIVE', 'HIGH',
   'kf', 'wechat-kf', 'mock-seed',
   now() - interval '1 days', now() - interval '1 hours', NULL, NULL,
   now() - interval '1 days', now() - interval '1 hours'),
  ('mock_contact_0003', 'woMockExternal003', '孙女士', '13900000003', 'ACTIVE', 'MEDIUM',
   'kf', 'wechat-kf', 'mock-seed',
   now() - interval '6 hours', now() - interval '30 minutes', NULL, NULL,
   now() - interval '6 hours', now() - interval '30 minutes'),
  ('mock_contact_0004', 'woMockExternal004', '周先生', '13900000004', 'ACTIVE', 'LOW',
   'kf', 'wechat-kf', 'mock-seed',
   now() - interval '2 hours', now() - interval '2 hours', NULL, NULL,
   now() - interval '2 hours', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- ─── 会话 Session（session_key 唯一，幂等键）────────────────
INSERT INTO conversation_sessions (id, contact_id, session_key, state, intent_level,
                                   turn_count, last_active_at, open_kf_id,
                                   created_at, updated_at) VALUES
  ('mock_session_0001', 'mock_contact_0001', 'wkMockKF001:woMockExternal001', 'CONVERTED', 'CLOSING',
   8, now() - interval '2 days', 'wkMockKF001',
   now() - interval '3 days', now() - interval '2 days'),
  ('mock_session_0002', 'mock_contact_0002', 'wkMockKF001:woMockExternal002', 'CLOSING', 'CLOSING',
   6, now() - interval '1 hours', 'wkMockKF001',
   now() - interval '1 days', now() - interval '1 hours'),
  ('mock_session_0003', 'mock_contact_0003', 'wkMockKF001:woMockExternal003', 'PRODUCT_MATCH', 'MEDIUM',
   4, now() - interval '30 minutes', 'wkMockKF001',
   now() - interval '6 hours', now() - interval '30 minutes'),
  ('mock_session_0004', 'mock_contact_0004', 'wkMockKF001:woMockExternal004', 'NEEDS_DISCOVERY', 'LOW',
   2, now() - interval '2 hours', 'wkMockKF001',
   now() - interval '2 hours', now() - interval '2 hours')
ON CONFLICT (session_key) DO NOTHING;

-- ─── 会话消息（kf_msg_id 唯一，幂等键）──────────────────────
-- 场景 1：王女士完整转化链路（咨询 → 异议 → 逼单卡片 → 成交）
INSERT INTO conversation_messages (id, session_id, role, type, content,
                                   ai_intent_level, ai_confidence, send_payment_card,
                                   recommended_product_id, external_user_id, kf_msg_id,
                                   open_kf_id, origin, send_time, created_at) VALUES
  ('mock_msg_0101', 'mock_session_0001', 'user', 'TEXT', '你好，那个冷萃拿铁礼盒怎么卖的？', NULL, NULL, false, NULL, 'woMockExternal001', 'mock-kfmsg-0101', 'wkMockKF001', 'CUSTOMER', now() - interval '3 days', now() - interval '3 days'),
  ('mock_msg_0102', 'mock_session_0001', 'assistant', 'TEXT', '您好！冷萃拿铁礼盒装售价 ¥99，内含 10 条冷萃液 + 2 个陶瓷杯，全国顺丰包邮～', 'MEDIUM', 0.86, false, NULL, 'woMockExternal001', 'mock-kfmsg-0102', 'wkMockKF001', 'SYSTEM', now() - interval '3 days' + interval '20 seconds', now() - interval '3 days' + interval '20 seconds'),
  ('mock_msg_0103', 'mock_session_0001', 'user', 'TEXT', '保质期多久？送人合适吗', NULL, NULL, false, NULL, 'woMockExternal001', 'mock-kfmsg-0103', 'wkMockKF001', 'CUSTOMER', now() - interval '3 days' + interval '3 minutes', now() - interval '3 days' + interval '3 minutes'),
  ('mock_msg_0104', 'mock_session_0001', 'assistant', 'TEXT', '常温保质期 9 个月，礼盒是送人级别的包装，还支持代写贺卡哦。最近下单立减 ¥29，很划算的～', 'HIGH', 0.9, false, NULL, 'woMockExternal001', 'mock-kfmsg-0104', 'wkMockKF001', 'SYSTEM', now() - interval '3 days' + interval '3 minutes' + interval '25 seconds', now() - interval '3 days' + interval '3 minutes' + interval '25 seconds'),
  ('mock_msg_0105', 'mock_session_0001', 'user', 'TEXT', '有点小贵，别家 79 就能买到', NULL, NULL, false, NULL, 'woMockExternal001', 'mock-kfmsg-0105', 'wkMockKF001', 'CUSTOMER', now() - interval '3 days' + interval '8 minutes', now() - interval '3 days' + interval '8 minutes'),
  ('mock_msg_0106', 'mock_session_0001', 'assistant', 'TEXT', '理解～我们用的是 100% 阿拉比卡豆和鲜萃工艺，成本确实高一些。今天通过客服下单可以再送一包挂耳试用装，这个赠品只有客服渠道有。', 'HIGH', 0.91, false, NULL, 'woMockExternal001', 'mock-kfmsg-0106', 'wkMockKF001', 'SYSTEM', now() - interval '3 days' + interval '8 minutes' + interval '22 seconds', now() - interval '3 days' + interval '8 minutes' + interval '22 seconds'),
  ('mock_msg_0107', 'mock_session_0001', 'user', 'TEXT', '行吧，那来一盒，怎么付款', NULL, NULL, false, NULL, 'woMockExternal001', 'mock-kfmsg-0107', 'wkMockKF001', 'CUSTOMER', now() - interval '2 days' + interval '1 minutes', now() - interval '2 days' + interval '1 minutes'),
  ('mock_msg_0108', 'mock_session_0001', 'assistant', 'MINIPROGRAM', '已为您创建订单，点击下方卡片即可完成支付', 'CLOSING', 0.95, true, 'mock_prod_0001', 'woMockExternal001', 'mock-kfmsg-0108', 'wkMockKF001', 'SYSTEM', now() - interval '2 days' + interval '1 minutes' + interval '18 seconds', now() - interval '2 days' + interval '1 minutes' + interval '18 seconds'),
  ('mock_msg_0109', 'mock_session_0001', 'assistant', 'SYSTEM_NOTE', '顾客已支付订单 WS20260907KF0001，会话转化', NULL, NULL, false, NULL, 'woMockExternal001', 'mock-kfmsg-0109', 'wkMockKF001', 'SYSTEM', now() - interval '2 days', now() - interval '2 days')
ON CONFLICT (kf_msg_id) DO NOTHING;

-- 场景 2：刘先生已发卡片待支付（CLOSING）
INSERT INTO conversation_messages (id, session_id, role, type, content,
                                   ai_intent_level, ai_confidence, send_payment_card,
                                   recommended_product_id, external_user_id, kf_msg_id,
                                   open_kf_id, origin, send_time, created_at) VALUES
  ('mock_msg_0201', 'mock_session_0002', 'user', 'TEXT', '保温杯还有什么色？', NULL, NULL, false, NULL, 'woMockExternal002', 'mock-kfmsg-0201', 'wkMockKF001', 'CUSTOMER', now() - interval '1 days', now() - interval '1 days'),
  ('mock_msg_0202', 'mock_session_0002', 'assistant', 'TEXT', '有曜石黑、云雾白、松石绿三个色，450ml 带tea滤网，¥89～', 'MEDIUM', 0.85, false, NULL, 'woMockExternal002', 'mock-kfmsg-0202', 'wkMockKF001', 'SYSTEM', now() - interval '1 days' + interval '20 seconds', now() - interval '1 days' + interval '20 seconds'),
  ('mock_msg_0203', 'mock_session_0002', 'user', 'TEXT', '黑色有货吗，能不能便宜点', NULL, NULL, false, NULL, 'woMockExternal002', 'mock-kfmsg-0203', 'wkMockKF001', 'CUSTOMER', now() - interval '2 hours', now() - interval '2 hours'),
  ('mock_msg_0204', 'mock_session_0002', 'assistant', 'TEXT', '黑色现货充足！客服下单立减 ¥10，实付 ¥79，给您建个单？', 'HIGH', 0.92, false, NULL, 'woMockExternal002', 'mock-kfmsg-0204', 'wkMockKF001', 'SYSTEM', now() - interval '2 hours' + interval '18 seconds', now() - interval '2 hours' + interval '18 seconds'),
  ('mock_msg_0205', 'mock_session_0002', 'user', 'TEXT', '建吧', NULL, NULL, false, NULL, 'woMockExternal002', 'mock-kfmsg-0205', 'wkMockKF001', 'CUSTOMER', now() - interval '1 hours', now() - interval '1 hours'),
  ('mock_msg_0206', 'mock_session_0002', 'assistant', 'MINIPROGRAM', '订单已创建，点击卡片 2 小时内完成支付即可', 'CLOSING', 0.94, true, 'mock_prod_0003', 'woMockExternal002', 'mock-kfmsg-0206', 'wkMockKF001', 'SYSTEM', now() - interval '1 hours' + interval '15 seconds', now() - interval '1 hours' + interval '15 seconds')
ON CONFLICT (kf_msg_id) DO NOTHING;

-- 场景 3：孙女士送礼咨询（PRODUCT_MATCH，异议处理样例）
INSERT INTO conversation_messages (id, session_id, role, type, content,
                                   ai_intent_level, ai_confidence, send_payment_card,
                                   recommended_product_id, external_user_id, kf_msg_id,
                                   open_kf_id, origin, send_time, created_at) VALUES
  ('mock_msg_0301', 'mock_session_0003', 'user', 'TEXT', '想给长辈买点茶叶，有什么推荐', NULL, NULL, false, NULL, 'woMockExternal003', 'mock-kfmsg-0301', 'wkMockKF001', 'CUSTOMER', now() - interval '6 hours', now() - interval '6 hours'),
  ('mock_msg_0302', 'mock_session_0003', 'assistant', 'TEXT', '送长辈推荐桂花乌龙礼盒 ¥49，或者白瓷功夫茶具套装 ¥199，体面又实用～预算大概多少？', 'MEDIUM', 0.87, false, NULL, 'woMockExternal003', 'mock-kfmsg-0302', 'wkMockKF001', 'SYSTEM', now() - interval '6 hours' + interval '25 seconds', now() - interval '6 hours' + interval '25 seconds'),
  ('mock_msg_0303', 'mock_session_0003', 'user', 'TEXT', '茶具是不是易碎，运输会不会坏', NULL, NULL, false, NULL, 'woMockExternal003', 'mock-kfmsg-0303', 'wkMockKF001', 'CUSTOMER', now() - interval '35 minutes', now() - interval '35 minutes'),
  ('mock_msg_0304', 'mock_session_0003', 'assistant', 'TEXT', '放心，茶具用泡沫全包裹 + 运费险，破损包赔，收到不满意 7 天无理由退换。', 'MEDIUM', 0.88, false, NULL, 'woMockExternal003', 'mock-kfmsg-0304', 'wkMockKF001', 'SYSTEM', now() - interval '30 minutes', now() - interval '30 minutes')
ON CONFLICT (kf_msg_id) DO NOTHING;

-- 场景 4：周先生随便看看（NEEDS_DISCOVERY）
INSERT INTO conversation_messages (id, session_id, role, type, content,
                                   ai_intent_level, ai_confidence, send_payment_card,
                                   recommended_product_id, external_user_id, kf_msg_id,
                                   open_kf_id, origin, send_time, created_at) VALUES
  ('mock_msg_0401', 'mock_session_0004', 'user', 'TEXT', '在吗', NULL, NULL, false, NULL, 'woMockExternal004', 'mock-kfmsg-0401', 'wkMockKF001', 'CUSTOMER', now() - interval '2 hours', now() - interval '2 hours'),
  ('mock_msg_0402', 'mock_session_0004', 'assistant', 'TEXT', '在的～我们是精品咖啡茶饮品牌，咖啡豆/茶/器具都有，想看点什么？', 'LOW', 0.7, false, NULL, 'woMockExternal004', 'mock-kfmsg-0402', 'wkMockKF001', 'SYSTEM', now() - interval '2 hours' + interval '15 seconds', now() - interval '2 hours' + interval '15 seconds')
ON CONFLICT (kf_msg_id) DO NOTHING;
