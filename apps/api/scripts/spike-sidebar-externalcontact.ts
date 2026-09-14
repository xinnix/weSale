/**
 * Spike: 验证企微「客户联系」域 API（侧边栏前置权限确认）
 *
 * 验证点：
 * 1. WX_WORK_SIDEBAR_SECRET 是否有 externalcontact + auth 权限（60011=无应用权限 / 48001=API未授权）
 * 2. get_jsapi_ticket（侧边栏 JS-SDK 签名前置）
 * 3. getExternalContact 拉取客户详情
 * 4. add_contact_way 生成「联系我」活码（多人场景 2：保存二维码）+ del_contact_way 清理
 *
 * 运行：pnpm --filter @opencode/api exec tsx scripts/spike-sidebar-externalcontact.ts
 */
import { config } from 'dotenv';
config({ path: '../../.env' });
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@opencode/database';
import { ConfigService } from '@nestjs/config';
import { WecomApiService } from '../src/modules/wecom/services/wecom-api.service';
import { RedisService } from '../src/shared/services/redis.service';

async function main() {
  const configService = new ConfigService();
  const corpId = configService.get<string>('WX_WORK_CORP_ID', '');
  const secret = configService.get<string>('WX_WORK_SIDEBAR_SECRET', '');
  const agentId = configService.get<string>('WX_WORK_AGENT_ID', '');
  if (!corpId || !secret) {
    throw new Error('缺少 WX_WORK_CORP_ID / WX_WORK_SIDEBAR_SECRET（客户联系应用 secret）');
  }
  console.log(`[spike] corpId=${corpId}, agentId=${agentId}`);

  const wecomApi = new WecomApiService(new RedisService(null as any));
  const token = await wecomApi.getAccessToken(corpId, secret);
  console.log('[spike] ✅ access_token 获取成功');

  // 1. get_jsapi_ticket
  try {
    const ticket = await wecomApi.getJsapiTicket(token);
    console.log(`[spike] ✅ get_jsapi_ticket: ${ticket.slice(0, 12)}…`);
  } catch (e: any) {
    console.log(`[spike] ⚠️ get_jsapi_ticket: ${e.message}`);
  }

  // 2. getExternalContact：取最近一条带 externalUserId 的 Contact（含 KF 建单的 fallback openId）
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const contact = await prisma.contact.findFirst({ orderBy: { updatedAt: 'desc' } });
  await prisma.$disconnect();

  if (contact) {
    const target = contact.externalUserId ?? contact.openId;
    try {
      const detail = await wecomApi.getExternalContact(token, target);
      const info = detail?.external_contact;
      console.log(
        `[spike] ✅ getExternalContact: name=${info?.name ?? '-'}, avatar=${info?.avatar ? '有' : '无'}, isFollow=${Array.isArray(detail?.follow_user) && detail.follow_user.length > 0}`,
      );
    } catch (e: any) {
      console.log(`[spike] ⚠️ getExternalContact: ${e.message}`);
    }
  } else {
    console.log('[spike] ⚠️ 无 Contact 记录，跳过 getExternalContact');
  }

  // 3. add_contact_way 活码（type=2 多人 / scene=2 二维码）+ 立即清理
  try {
    const state = `spike_${Date.now().toString(36).slice(-6)}`;
    const created = await wecomApi.addContactWay(token, {
      type: 2,
      scene: 2,
      state,
      remark: 'spike 活码（自动清理）',
    });
    console.log(`[spike] ✅ add_contact_way: config_id=${created.config_id}, state=${state}`);
    if (created.config_id) {
      await wecomApi.delContactWay(token, created.config_id);
      console.log('[spike] ✅ del_contact_way 清理成功');
    }
  } catch (e: any) {
    console.log(`[spike] ⚠️ add_contact_way: ${e.message}`);
  }

  console.log(
    '[spike] errcode 参考: 60011=无该应用权限 48001=API 未授权(未开通客户联系) 41059=缺少标签 40058=参数错误',
  );
}

main().catch((err) => {
  console.error('[spike] ❌ 失败:', err.message);
  process.exit(1);
});
