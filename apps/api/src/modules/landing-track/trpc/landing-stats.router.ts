import { z } from 'zod';
import { protectedProcedure } from '../../../trpc/trpc';
import { LandingTrackService } from '../services/landing-track.service';

const rangeSchema = z.object({
  days: z.number().int().min(1).max(90).optional(),
});

const getDays = (input?: z.infer<typeof rangeSchema>) => input?.days ?? 7;

const sinceDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

const getService = (ctx: any) => new LandingTrackService(ctx.prisma);

export const landingStatsRouter = {
  overview: protectedProcedure.input(rangeSchema.optional()).query(async ({ ctx, input }) => {
    const days = getDays(input);
    return getService(ctx).getOverview(sinceDate(days));
  }),

  timeSeries: protectedProcedure.input(rangeSchema.optional()).query(async ({ ctx, input }) => {
    const days = getDays(input);
    return getService(ctx).getTimeSeries(sinceDate(days), days);
  }),

  topPaths: protectedProcedure.input(rangeSchema.optional()).query(async ({ ctx, input }) => {
    const days = getDays(input);
    return getService(ctx).getTopPaths(sinceDate(days), 5);
  }),

  topSources: protectedProcedure.input(rangeSchema.optional()).query(async ({ ctx, input }) => {
    const days = getDays(input);
    return getService(ctx).getTopSources(sinceDate(days), 5);
  }),
};
