import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WecomApiService } from '../../wecom/services/wecom-api.service';
import { SidebarTagsService, TagItem } from './sidebar-tags.service';

@Injectable()
export class SidebarProfileService {
  private readonly logger = new Logger(SidebarProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wecomApi: WecomApiService,
    private readonly tagsService: SidebarTagsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 客户画像聚合（侧边栏核心）：
   * 定位 Contact（externalUserId 优先，回退 KF openId）→ 联出 User 完整订单历史 + 最近 KF 会话
   * → 行为标签实时推导 + 渠道标签合并
   */
  async getProfile(
    externalUserId: string,
    member: { userId: string; corpId: string },
  ): Promise<any> {
    let contact =
      (await this.prisma.contact.findUnique({ where: { externalUserId } })) ??
      (await this.prisma.contact.findFirst({ where: { openId: externalUserId } }));

    if (!contact) {
      // 自动建档：新客户（未走过 KF/归因）打开侧边栏时创建空画像，
      // 后续随粘贴对话资产化、交易、归因回调逐步完善
      contact = await this.prisma.contact
        .create({
          data: {
            openId: externalUserId,
            externalUserId,
            metadata: { autoProfile: true, createdAt: new Date().toISOString() },
          },
        })
        .catch(async () => {
          // 并发/唯一冲突兜底：再查一次
          return (
            (await this.prisma.contact.findUnique({ where: { externalUserId } })) ??
            (await this.prisma.contact.findFirst({ where: { openId: externalUserId } }))
          );
        });
    }

    if (!contact) throw new NotFoundException('客户画像创建失败');

    // 企微客户详情软校验（quarantine：API 不可用/未配置不阻断，失败仅告警）
    const external = await this.fetchExternalDetail(externalUserId, member.corpId);

    // OneID 打通后联出小程序用户完整订单历史
    const user = contact.userId
      ? await this.prisma.user.findUnique({
          where: { id: contact.userId },
          include: { orders: { include: { product: true }, orderBy: { createdAt: 'desc' } } },
        })
      : null;

    // Contact 直接订单（KF 逼单单等）
    const contactOrders = await this.prisma.order.findMany({
      where: { contactId: contact.id },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    // 最近会话摘要：KF 会话记录 + 销售粘贴的实时对话（合并按时间排序，企微无 API 可读历史）
    const kfMessages = await this.prisma.conversationMessage.findMany({
      where: { externalUserId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const pastedRows = await this.prisma.pastedConversation.findMany({
      where: { externalUserId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const recentMessages = [
      ...pastedRows.map((p) => ({
        role: 'note' as const,
        content: p.content,
        createdAt: p.createdAt,
      })),
      ...kfMessages,
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    const orders = this.mergeOrders(user?.orders ?? [], contactOrders);
    const behaviorTags = this.tagsService.deriveBehaviorTags(orders as any);
    const tags = this.tagsService.merge((contact.tags as unknown as TagItem[]) ?? [], behaviorTags);

    const paidOrders = orders.filter((o) => o.status === 'PAID' || o.status === 'COMPLETED');
    const stats = {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      totalPaidAmountFen: paidOrders.reduce((s, o) => s + o.totalAmountFen, 0),
      pointsBalance: contact.pointsBalance,
      firstOrderAt: paidOrders[paidOrders.length - 1]?.paidAt ?? null,
      lastOrderAt: paidOrders[0]?.paidAt ?? null,
    };

    return {
      member,
      external,
      contact: {
        id: contact.id,
        nickname: contact.nickname,
        avatarUrl: contact.avatarUrl,
        intentLevel: contact.intentLevel,
        status: contact.status,
      },
      tags,
      orders: orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.status,
        totalAmountFen: o.totalAmountFen,
        productName: o.product?.name ?? null,
        category: o.product?.category ?? null,
        source: o.source,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
      stats,
      recentMessages: recentMessages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  /** 订单历史合并：小程序侧(user.orders) + KF 侧(contact orders)，按 id 去重 */
  private mergeOrders(userOrders: any[], contactOrders: any[]): any[] {
    const map = new Map<string, any>();
    for (const o of userOrders) map.set(o.id, o);
    for (const o of contactOrders) if (!map.has(o.id)) map.set(o.id, o);
    return [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** 企微客户详情补充（name/avatar）；未配置 secret 或 API 失败时降级 null 不阻断 */
  private async fetchExternalDetail(
    externalUserId: string,
    corpId: string,
  ): Promise<{
    userName?: string | null;
    avatarUrl?: string | null;
    isFollow?: boolean;
  } | null> {
    const secret = this.config.get<string>('WX_WORK_SIDEBAR_SECRET', '');
    if (!secret) return null;

    try {
      const token = await this.wecomApi.getAccessToken(corpId, secret);
      const data = await this.wecomApi.getExternalContact(token, externalUserId);
      const info = data?.external_contact;
      if (!info) return null;
      return {
        userName: info.name ?? null,
        avatarUrl: info.avatar ?? null,
        isFollow: Array.isArray(data?.follow_user) && data.follow_user.length > 0,
      };
    } catch (err: any) {
      this.logger.warn(`客户详情软校验失败（降级返回自有画像）: ${externalUserId}`, err.message);
      return null;
    }
  }
}
