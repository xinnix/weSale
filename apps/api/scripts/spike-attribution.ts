/**
 * Spike: 验证 change_external_contact 归因落库（Contact 自动建立 + externalUserId 关联）
 * 用真实好友 ID 模拟企微事件，走 ExternalContactService 完整链路
 *
 * 运行：pnpm --filter @opencode/api exec tsx scripts/spike-attribution.ts [externalUserId]
 */
import { config } from 'dotenv';
config({ path: '../../.env' });
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/shared/services/redis.service';
import { WecomApiService } from '../src/modules/wecom/services/wecom-api.service';
import { ExternalContactService } from '../src/modules/wecom/services/external-contact.service';

async function main() {
  const externalUserId = process.argv[2];
  if (!externalUserId) throw new Error('用法: tsx scripts/spike-attribution.ts <ExternalUserID>');

  const corpId = process.env.WX_WORK_CORP_ID || '';
  const svc = new ExternalContactService(
    new PrismaService(),
    new ConfigService(),
    new WecomApiService(new RedisService(null as any)),
  );

  await svc.handleChangeEvent({ corpId }, {
    MsgType: 'event',
    Event: 'change_external_contact',
    ChangeType: 'add_external_contact',
    UserID: process.env.WX_WORK_AGENT_ID || 'xinnix',
    ExternalUserID: externalUserId,
  } as any);

  const prisma = svc['prisma'];
  const contact = await prisma.contact.findUnique({
    where: { externalUserId },
    select: { id: true, openId: true, externalUserId: true, nickname: true, tags: true },
  });
  console.log('[spike] 归因结果:', JSON.stringify(contact, null, 2));
  if (!contact) throw new Error('归因后未找到 Contact');
  console.log('[spike] ✅ Contact 自动建立且 externalUserId 已关联');
}

main().catch((err) => {
  console.error('[spike] ❌ 失败:', err.message);
  process.exit(1);
});
