import { z } from 'zod';
import { protectedProcedure } from '../../../trpc/trpc';
import { WechatKfApiService } from '../services/kf-api.service';
import { WecomApiService } from '../../wecom/services/wecom-api.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../shared/services/redis.service';

// 与 wecom router 相同的模式：模块级服务实例
const kfApiService = new WechatKfApiService(
  new WecomApiService(new RedisService(null as any)),
  new ConfigService(),
);

export const wechatKfRouter = {
  // 获取客服账号列表
  getKfAccounts: protectedProcedure
    .input(
      z.object({
        offset: z.number().int().min(0).optional().default(0),
        limit: z.number().int().min(1).max(100).optional().default(100),
      }),
    )
    .query(async ({ input }) => {
      return kfApiService.getKfAccountList(input.offset, input.limit);
    }),

  // 发送文本消息
  sendText: protectedProcedure
    .input(
      z.object({
        openKfId: z.string().min(1),
        externalUserId: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return kfApiService.sendText(input.openKfId, input.externalUserId, input.content);
    }),

  // 发送链接消息
  sendLink: protectedProcedure
    .input(
      z.object({
        openKfId: z.string().min(1),
        externalUserId: z.string().min(1),
        title: z.string().min(1),
        desc: z.string().optional(),
        url: z.string().min(1),
        thumbUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return kfApiService.sendLink(input.openKfId, input.externalUserId, {
        title: input.title,
        desc: input.desc || '',
        url: input.url,
        thumb_url: input.thumbUrl,
      });
    }),

  // 同步客服消息
  syncMessages: protectedProcedure
    .input(
      z.object({
        openKfId: z.string().min(1),
        cursor: z.string().optional(),
        token: z.string().optional(),
        limit: z.number().int().min(1).max(1000).optional().default(1000),
      }),
    )
    .query(async ({ input }) => {
      return kfApiService.syncKfMessage(input.openKfId, input.cursor, input.token, input.limit);
    }),
};
