/**
 * Spike: 端到端验证侧边栏画像聚合（OneID → 订单历史 → 语义标签推导）
 *
 * 步骤：幂等造演示数据（Contact + User + 2 笔 PAID 订单 + OneID 关联）
 *      → 手动装配 SidebarProfileService → getProfile 输出画像（含行为标签：复购常客/高客单价）
 *
 * 运行：pnpm --filter @opencode/api exec tsx scripts/spike-sidebar-profile.ts
 */
import { config } from 'dotenv';
config({ path: '../../.env' });
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@opencode/database';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/shared/services/redis.service';
import { WecomApiService } from '../src/modules/wecom/services/wecom-api.service';
import { SidebarProfileService } from '../src/modules/sidebar/services/sidebar-profile.service';
import { SidebarTagsService } from '../src/modules/sidebar/services/sidebar-tags.service';

const EXTERNAL_USER_ID = 'wm_demo_customer';
const DEMO_OPENID = 'demo_openid_copilot';

async function seedDemo() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user =
    (await prisma.user.findUnique({ where: { openid: DEMO_OPENID } })) ??
    (await prisma.user.create({
      data: { openid: DEMO_OPENID, username: 'demo_copilot', nickname: '演示顾客' },
    }));

  const contact =
    (await prisma.contact.findUnique({ where: { externalUserId: EXTERNAL_USER_ID } })) ??
    (await prisma.contact.create({
      data: {
        openId: EXTERNAL_USER_ID,
        externalUserId: EXTERNAL_USER_ID,
        nickname: '演示顾客',
        userId: user.id,
      },
    }));
  if (contact && !contact.userId) {
    await prisma.contact.update({ where: { id: contact.id }, data: { userId: user.id } });
  }

  const product = await prisma.product.findFirst();
  if (!product) throw new Error('无商品，先 /seed-data 或 seed-mall.sql');
  const existing = await prisma.order.count({ where: { userId: user.id } });
  if (existing === 0) {
    const now = new Date();
    for (let i = 0; i < 2; i += 1) {
      await prisma.order.create({
        data: {
          orderNo: `WS${Date.now()}${i}`,
          source: 'KF_SESSION',
          contactId: contact.id,
          userId: user.id,
          productId: product.id,
          quantity: 1,
          unitPriceFen: 6800,
          totalAmountFen: 6800,
          status: 'PAID',
          paidAt: new Date(now.getTime() - i * 86_400_000),
        },
      });
    }
  }
  await prisma.$disconnect();
}

async function main() {
  await seedDemo();

  const profileService = new SidebarProfileService(
    new PrismaService(),
    new WecomApiService(new RedisService(null as any)),
    new SidebarTagsService(),
    new ConfigService(),
  );

  const profile = await profileService.getProfile(EXTERNAL_USER_ID, {
    userId: 'zhangsan',
    corpId: 'ww_demo',
  });

  console.log('\n=== 侧边栏客户画像（demo）===');
  console.log('member:', JSON.stringify(profile.member));
  console.log('external(企微详情，无 secret 时为 null):', JSON.stringify(profile.external));
  console.log('contact:', JSON.stringify(profile.contact));
  console.log('tags(语义标签):', JSON.stringify(profile.tags));
  console.log('stats:', JSON.stringify(profile.stats));
  console.log(
    'orders:',
    JSON.stringify(
      profile.orders.map((o: any) => ({
        orderNo: o.orderNo,
        status: o.status,
        amount: o.totalAmountFen,
        paidAt: o.paidAt,
      })),
    ),
  );
}

main().catch((err) => {
  console.error('[spike] ❌ 失败:', err.message);
  process.exit(1);
});
