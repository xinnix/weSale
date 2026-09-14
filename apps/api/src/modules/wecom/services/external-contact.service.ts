import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@opencode/database';
import { PrismaService } from '../../../prisma/prisma.service';
import { WecomApiService } from './wecom-api.service';

interface LiveCodeRecord {
  id: string;
  name: string;
  state: string;
  autoTags: { name: string; tagId?: string }[];
}

interface TagItem {
  name: string;
  source: 'CHANNEL' | 'LIVECODE' | 'BEHAVIOR';
  refId?: string;
  at: string;
}

/**
 * change_external_contact 企微好友事件归因分发（F2/F8 获客归因）
 * - add_external_contact / add_half_external_contact：按 state 匹配活码 → Contact 关联/建立 + autoTags 双写
 * - del_external_contact：清空 Contact.externalUserId（保留行与订单/会话）
 */
@Injectable()
export class ExternalContactService {
  private readonly logger = new Logger(ExternalContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wecomApi: WecomApiService,
  ) {}

  async handleChangeEvent(
    config: { corpId: string },
    parsed: Record<string, string>,
  ): Promise<void> {
    const changeType = parsed.ChangeType;
    const externalUserId = parsed.ExternalUserID;
    if (!externalUserId) return;

    if (changeType === 'add_external_contact' || changeType === 'add_half_external_contact') {
      await this.handleAdd(config, parsed.State, externalUserId);
    } else if (changeType === 'del_external_contact') {
      await this.handleDelete(externalUserId);
    }
    // del_follow_user（接待成员解除）V1 忽略
  }

  private async handleAdd(
    config: { corpId: string },
    state: string | undefined,
    externalUserId: string,
  ): Promise<void> {
    // 按 state 匹配 ACTIVE 活码（物料活码归因；无 state / 未匹配 = KF 引导或普通加好友，仅关联）
    let liveCode: LiveCodeRecord | null = null;
    if (state) {
      const found = await this.prisma.liveCode.findUnique({ where: { state } });
      if (found && found.status === 'ACTIVE') {
        liveCode = {
          id: found.id,
          name: found.name,
          state: found.state,
          autoTags: found.autoTags as any,
        };
      }
    }
    const autoTags = liveCode?.autoTags ?? [];

    const contact = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.contact.findUnique({ where: { openId: externalUserId } });
      const now = new Date().toISOString();

      if (existing) {
        return tx.contact.update({
          where: { id: existing.id },
          data: {
            externalUserId,
            utmSource: liveCode ? liveCode.state : existing.utmSource,
            metadata: this.mergeMetadata(existing.metadata, liveCode),
            tags: liveCode
              ? (this.mergeAutoTags(
                  existing.tags,
                  autoTags,
                  liveCode.id,
                  now,
                ) as unknown as Prisma.InputJsonValue)
              : undefined,
          },
        });
      }
      return tx.contact.create({
        data: {
          openId: externalUserId,
          externalUserId,
          utmSource: liveCode?.state,
          metadata: liveCode ? { liveCodeId: liveCode.id } : undefined,
          tags: liveCode
            ? (autoTags.map((t) =>
                this.toTag(t, liveCode.id, now),
              ) as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });
    });

    // 企微原生 mark_tags 双写（尽力而为，失败降级 log 不阻断回调）
    if (liveCode && autoTags.length) {
      void this.trySyncWecomTags(config.corpId, externalUserId, autoTags).catch((err) =>
        this.logger.warn(`mark_tags 双写失败（降级，仅自有标签生效）: ${err.message}`),
      );
    }

    this.logger.log(
      `活码归因: ${externalUserId} ${
        liveCode ? '→ ' + liveCode.name + ' (' + liveCode.state + ')' : '（无活码匹配，仅关联）'
      }`,
    );
  }

  private async handleDelete(externalUserId: string): Promise<void> {
    await this.prisma.contact.updateMany({
      where: { openId: externalUserId },
      data: { externalUserId: null },
    });
  }

  private mergeMetadata(
    metadata: Prisma.JsonValue | null | undefined,
    liveCode: LiveCodeRecord | null,
  ): Prisma.JsonObject | undefined {
    if (!liveCode) return undefined;
    const base: Record<string, any> = (metadata as Record<string, any>) ?? {};
    return {
      ...base,
      liveCodeId: liveCode.id,
      liveCodeState: liveCode.state,
      addedAt: new Date().toISOString(),
    };
  }

  private mergeAutoTags(
    existing: Prisma.JsonValue,
    autoTags: { name: string }[],
    liveCodeId: string,
    now: string,
  ): TagItem[] {
    const base = Array.isArray(existing) ? (existing as unknown as TagItem[]) : [];
    const merged = [...base];
    for (const t of autoTags) {
      if (!merged.some((x) => x.source === 'LIVECODE' && x.name === t.name)) {
        merged.push(this.toTag(t, liveCodeId, now));
      }
    }
    return merged;
  }

  private toTag(t: { name: string }, refId: string, at: string): TagItem {
    return { name: t.name, source: 'LIVECODE', refId, at };
  }

  /** 企微原生标签双写（需客户联系权限；仅同步有 tagId 的自动标签，缺失 tagId 的留待 F8 里程碑补建） */
  private async trySyncWecomTags(
    corpId: string,
    externalUserId: string,
    autoTags: { name: string; tagId?: string }[],
  ): Promise<void> {
    const secret = this.config.get<string>('WX_WORK_SIDEBAR_SECRET', '');
    if (!secret) return;
    const tagIds = autoTags.filter((t) => t.tagId).map((t) => t.tagId as string);
    if (!tagIds.length) return;

    const token = await this.wecomApi.getAccessToken(corpId, secret);
    await this.wecomApi.markTags(token, { externalUserId, addTag: tagIds });
  }
}
