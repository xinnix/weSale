import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SendEventInput {
  externalUserId: string;
  generationId?: string;
  strategy?: string;
  msgType: string;
  adopted?: boolean;
  contentSnapshot?: string;
}

const VALID_STRATEGIES = new Set(['A_RATIONAL', 'B_EMOTIONAL', 'C_UPSELL']);

/**
 * 发送事件流水（开放问题 #8）：采纳率 + 合规审计
 * 侧边栏走企微 JS-SDK 客户端发送，后端不经手 → 由前端上报落库
 */
@Injectable()
export class SendEventService {
  private readonly logger = new Logger(SendEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: SendEventInput, member: { userId: string; corpId: string }) {
    // 不信任前端 contactId，按 externalUserId 服务端反查
    const contact =
      (await this.prisma.contact.findUnique({
        where: { externalUserId: input.externalUserId },
      })) ?? (await this.prisma.contact.findFirst({ where: { openId: input.externalUserId } }));

    const event = await this.prisma.sendEvent.create({
      data: {
        memberUserId: member.userId,
        corpId: member.corpId,
        externalUserId: input.externalUserId,
        contactId: contact?.id,
        generationId: input.generationId,
        strategy: VALID_STRATEGIES.has(input.strategy || '') ? (input.strategy as any) : undefined,
        msgType: input.msgType === 'miniprogram' ? 'miniprogram' : 'text',
        adopted: input.adopted ?? true,
        contentSnapshot: input.contentSnapshot?.slice(0, 2000),
      },
    });

    this.logger.log(
      `发送上报: member=${member.userId} contact=${externalContactLabel(contact)} strategy=${event.strategy ?? '-'} adopted=${event.adopted}`,
    );
    return { id: event.id, sentAt: event.sentAt };
  }
}

function externalContactLabel(contact: { nickname: string | null } | null): string {
  return contact?.nickname || '(未匹配 Contact)';
}
