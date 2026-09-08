/**
 * Spike: 验证企微客服 send_msg 发送小程序卡片链路（Phase 1 风险项 #1）
 *
 * 验证点：
 * 1. 临时素材上传（封面图 → media_id）
 * 2. send_msg msgtype=miniprogram 是否被接受（小程序与企微的关联要求）
 *
 * 运行：pnpm --filter @opencode/api exec tsx scripts/spike-kf-miniprogram.ts
 */
import { config } from 'dotenv';
// .env 在仓库根，dotenv 默认不向上查找
config({ path: '../../.env' });
import { PrismaClient } from '@opencode/database';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WecomApiService } from '../src/modules/wecom/services/wecom-api.service';
import { WechatKfApiService } from '../src/modules/wechat-kf/services/kf-api.service';
import { RedisService } from '../src/shared/services/redis.service';

async function main() {
  const configService = new ConfigService();
  // 与 trpc router 相同的模式：Redis 不可用时服务内部静默降级
  const wecomApi = new WecomApiService(new RedisService(null as any));
  const kfApi = new WechatKfApiService(wecomApi, configService);

  const openKfId = configService.get<string>('WX_WORK_KF_OPEN_KFID', '');
  const miniappAppid = configService.get<string>('MINIAPP_APPID', '');
  if (!openKfId) {
    throw new Error('缺少 WX_WORK_KF_OPEN_KFID');
  }
  if (!miniappAppid) {
    throw new Error('缺少 MINIAPP_APPID（小程序 appid，Phase 1 新增配置）');
  }
  console.log(`[spike] openKfId=${openKfId}, miniappAppid=${miniappAppid}`);

  // 1. 取最近活跃的 Contact 作为接收人
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const contact = await prisma.contact.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { openId: true, nickname: true },
  });
  await prisma.$disconnect();
  if (!contact) {
    throw new Error('数据库中没有 Contact 记录，无法指定接收人');
  }
  console.log(`[spike] 接收人: ${contact.openId} (${contact.nickname ?? '未命名'})`);

  // 2. 上传封面图（media/upload 属通用接口，按自建应用校验可信 IP，
  //    kf token 可能被 60020 挡——依次尝试 kf token 与自建应用 token）
  const coverPath = join(__dirname, '../../miniapp/src/static/share-default.png');
  const coverBuffer = readFileSync(coverPath);
  console.log(`[spike] 上传封面图 ${coverPath} (${coverBuffer.length} bytes)...`);
  let mediaId: string;
  try {
    mediaId = await kfApi.uploadKfTempImage(coverBuffer, 'share-default.png');
  } catch (err: any) {
    if (!err.message.includes('60020')) throw err;
    console.log('[spike] kf token 被拒（60020），改用自建应用 token 上传...');
    const corpId = configService.get<string>('WX_WORK_CORP_ID', '');
    const appSecret = configService.get<string>('WX_WORK_SECRET', '');
    const appToken = await wecomApi.getAccessToken(corpId, appSecret);
    const result = await wecomApi.uploadTempImage(appToken, coverBuffer, 'share-default.png');
    mediaId = result.media_id;
  }
  console.log(`[spike] ✅ media_id=${mediaId}`);

  // 3. 发送小程序卡片
  console.log('[spike] 发送小程序卡片...');
  const result = await kfApi.sendMiniProgram(openKfId, contact.openId, {
    appid: miniappAppid,
    title: 'Spike 测试：小程序卡片',
    thumbMediaId: mediaId,
    pagePath: 'pages/index/index?from=kf_spike',
  });
  console.log('[spike] ✅ 发送成功:', JSON.stringify(result));
  console.log('[spike] 请在微信客服会话中确认卡片展示与点击跳转。');
}

main().catch((err) => {
  console.error('[spike] ❌ 失败:', err.message);
  if (err.message.includes('errcode')) {
    console.error(
      '[spike] errcode 参考: 40036=不合法appid, 810003=接收人不合法/超时, 95011=48h窗口限制',
    );
  }
  process.exit(1);
});
