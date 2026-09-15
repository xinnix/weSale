/**
 * 初始化侧边栏接待成员白名单
 *
 * 侧边栏登录前提：WecomConfig 记录存在且 memberUserids 含当前企微成员
 * 白名单成员读取顺序：WX_WORK_SIDEBAR_WHITELIST（逗号分隔）→ 默认 'xinnix'
 *
 * 运行：pnpm --filter @opencode/api exec tsx scripts/seed-sidebar-whitelist.ts
 */
import { config } from 'dotenv';
config({ path: '../../.env' });
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@opencode/database';

async function main() {
  const corpId = process.env.WX_WORK_CORP_ID || '';
  const agentId = Number(process.env.WX_WORK_AGENT_ID || '0');
  if (!corpId || !agentId) {
    throw new Error('缺少 WX_WORK_CORP_ID / WX_WORK_AGENT_ID');
  }

  const members = (process.env.WX_WORK_SIDEBAR_WHITELIST || 'xinnix')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const row = await prisma.wecomConfig.upsert({
    where: { corpId_agentId: { corpId, agentId } },
    update: { memberUserids: members, isActive: true },
    create: {
      name: '默认自建应用',
      corpId,
      agentId,
      secret: process.env.WX_WORK_SECRET || '',
      token: process.env.WX_WORK_TOKEN || '',
      encodingAESKey: process.env.WX_WORK_ENCODING_AES_KEY || '',
      memberUserids: members,
    },
  });

  console.log(`[seed] WecomConfig upserted: id=${row.id} corpId=${corpId} agentId=${agentId}`);
  console.log(`[seed] 接待成员白名单 = ${JSON.stringify(members)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[seed] ❌ 失败:', err.message);
  process.exit(1);
});
