import { z } from 'zod';
import {
  createCrudRouter,
  createCrudRouterWithCustom,
  protectedProcedure,
} from '../../../trpc/trpc.helper';
import { UpdateContactSchema, UpdateConversationSessionSchema } from '@opencode/shared';
import { WechatKfApiService } from '../services/kf-api.service';
import { WecomApiService } from '../../wecom/services/wecom-api.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../shared/services/redis.service';

// 与 wecom router 相同的模式：模块级服务实例
const kfApiService = new WechatKfApiService(
  new WecomApiService(new RedisService(null as any)),
  new ConfigService(),
);

// ============================================
// Contact 子路由 — 访客管理
// ============================================
const contactRouter = createCrudRouter(
  'Contact',
  {
    update: UpdateContactSchema,
  },
  {
    searchFields: ['openId', 'nickname', 'phone'],
    filterableFields: ['status', 'intentLevel'],
    includeCreate: false,
    includeDelete: false,
    includeDeleteMany: false,
    protectedGetMany: true,
    protectedGetOne: true,
    protectedUpdate: true,
  },
);

// ============================================
// Session 子路由 — 会话管理
// ============================================
const sessionRouter = createCrudRouterWithCustom(
  'ConversationSession',
  {
    update: UpdateConversationSessionSchema,
  },
  () => ({
    getMany: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().optional().default(1),
          limit: z.number().int().positive().optional().default(10),
          search: z
            .object({
              keyword: z.string().optional(),
              fields: z.array(z.string()).optional(),
            })
            .optional(),
          filter: z
            .array(
              z.object({
                field: z.string(),
                operator: z
                  .enum(['eq', 'ne', 'contains', 'gte', 'lte', 'in'])
                  .optional()
                  .default('eq'),
                value: z.any(),
              }),
            )
            .optional(),
          where: z.any().optional(),
          orderBy: z.any().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { page, limit, search, filter, where: inputWhere, orderBy } = input;
        const skip = (page - 1) * limit;

        const where: any = inputWhere ? { ...inputWhere } : {};

        if (search?.keyword) {
          where.OR = [
            { contact: { nickname: { contains: search.keyword, mode: 'insensitive' } } },
            { contact: { openId: { contains: search.keyword, mode: 'insensitive' } } },
            { sessionKey: { contains: search.keyword, mode: 'insensitive' } },
          ];
        }

        if (filter?.length) {
          for (const f of filter) {
            if (['state', 'intentLevel', 'openKfId'].includes(f.field)) {
              where[f.field] = f.operator === 'eq' ? f.value : { [f.operator]: f.value };
            }
          }
        }

        const [items, total] = await Promise.all([
          ctx.prisma.conversationSession.findMany({
            where,
            skip,
            take: limit,
            orderBy: orderBy || { lastActiveAt: 'desc' },
            include: { contact: true },
          }),
          ctx.prisma.conversationSession.count({ where }),
        ]);

        return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
      }),

    getOne: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      return ctx.prisma.conversationSession.findUnique({
        where: { id: input.id },
        include: {
          contact: true,
          messages: {
            orderBy: { sendTime: 'asc' },
          },
        },
      });
    }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          data: UpdateConversationSessionSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.conversationSession.update({
          where: { id: input.id },
          data: input.data,
          include: { contact: true },
        });
      }),

    takeOver: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await ctx.prisma.conversationSession.findUnique({
          where: { id: input.id },
          include: { contact: true },
        });
        if (!session) throw new Error('会话不存在');

        try {
          await kfApiService.transKfServiceState(session.openKfId, session.contact.openId, 3);
        } catch (e) {
          console.error('transKfServiceState failed:', e);
        }

        return ctx.prisma.conversationSession.update({
          where: { id: input.id },
          data: { state: 'ESCALATED' },
          include: { contact: true },
        });
      }),

    closeSession: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.conversationSession.update({
          where: { id: input.id },
          data: { state: 'TIMED_OUT' },
          include: { contact: true },
        });
      }),
  }),
  {
    includeGetMany: false,
    includeGetOne: false,
    includeCreate: false,
    includeUpdate: false,
    includeDelete: false,
    includeDeleteMany: false,
  },
);

// ============================================
// Message 子路由 — 消息管理
// ============================================
const messageRouter = createCrudRouterWithCustom(
  'ConversationMessage',
  {},
  () => ({
    getMany: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          page: z.number().int().positive().optional().default(1),
          limit: z.number().int().positive().optional().default(50),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { sessionId, page, limit } = input;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
          ctx.prisma.conversationMessage.findMany({
            where: { sessionId },
            skip,
            take: limit,
            orderBy: { sendTime: 'asc' },
          }),
          ctx.prisma.conversationMessage.count({ where: { sessionId } }),
        ]);

        return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
      }),

    sendText: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          content: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await ctx.prisma.conversationSession.findUnique({
          where: { id: input.sessionId },
          include: { contact: true },
        });
        if (!session) throw new Error('会话不存在');

        await kfApiService.sendText(session.openKfId, session.contact.openId, input.content);

        const message = await ctx.prisma.conversationMessage.create({
          data: {
            sessionId: input.sessionId,
            role: 'assistant',
            type: 'TEXT',
            origin: 'SERVICER',
            content: input.content,
            openKfId: session.openKfId,
            externalUserId: session.contact.openId,
            servicerUserId: (ctx as any).user?.id || 'admin',
            sendTime: new Date(),
          },
        });

        await ctx.prisma.conversationSession.update({
          where: { id: input.sessionId },
          data: { lastActiveAt: new Date() },
        });

        return message;
      }),

    sendLink: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          title: z.string().min(1),
          desc: z.string().optional(),
          url: z.string().min(1),
          thumbUrl: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await ctx.prisma.conversationSession.findUnique({
          where: { id: input.sessionId },
          include: { contact: true },
        });
        if (!session) throw new Error('会话不存在');

        await kfApiService.sendLink(session.openKfId, session.contact.openId, {
          title: input.title,
          desc: input.desc || '',
          url: input.url,
          thumb_url: input.thumbUrl,
        });

        const message = await ctx.prisma.conversationMessage.create({
          data: {
            sessionId: input.sessionId,
            role: 'assistant',
            type: 'LINK_CARD',
            origin: 'SERVICER',
            content: JSON.stringify({
              title: input.title,
              desc: input.desc,
              url: input.url,
              thumbUrl: input.thumbUrl,
            }),
            openKfId: session.openKfId,
            externalUserId: session.contact.openId,
            servicerUserId: (ctx as any).user?.id || 'admin',
            sendTime: new Date(),
          },
        });

        await ctx.prisma.conversationSession.update({
          where: { id: input.sessionId },
          data: { lastActiveAt: new Date() },
        });

        return message;
      }),

    addNote: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          content: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.conversationMessage.create({
          data: {
            sessionId: input.sessionId,
            role: 'assistant',
            type: 'SYSTEM_NOTE',
            origin: 'SYSTEM',
            content: input.content,
            internalNote: input.content,
            servicerUserId: (ctx as any).user?.id || 'admin',
            sendTime: new Date(),
          },
        });
      }),
  }),
  {
    includeGetMany: false,
    includeGetOne: false,
    includeCreate: false,
    includeUpdate: false,
    includeDelete: false,
    includeDeleteMany: false,
  },
);

// ============================================
// Account 子路由 — 客服账号
// ============================================
const accountRouter = {
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
};

// ============================================
// 主 Router
// ============================================
export const wechatKfRouter = {
  contact: contactRouter,
  session: sessionRouter,
  message: messageRouter,
  account: accountRouter,
};
