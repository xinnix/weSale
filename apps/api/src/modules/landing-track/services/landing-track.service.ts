import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class LandingTrackService {
  private readonly logger = new Logger(LandingTrackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordView(input: {
    path: string;
    referrer?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    sessionId?: string | null;
    userAgent?: string | null;
    ip?: string | null;
  }) {
    const path = (input.path || '/').slice(0, 255);
    const referrer = (input.referrer || null)?.slice(0, 512) || null;
    const utmSource = (input.utmSource || null)?.slice(0, 128) || null;
    const utmMedium = (input.utmMedium || null)?.slice(0, 128) || null;
    const utmCampaign = (input.utmCampaign || null)?.slice(0, 128) || null;
    const userAgent = (input.userAgent || null)?.slice(0, 512) || null;

    const sessionId =
      input.sessionId?.slice(0, 64) ||
      this.deriveSessionId({ ip: input.ip, userAgent: input.userAgent });
    const ipHash = input.ip ? this.hashIp(input.ip) : null;

    try {
      await this.prisma.landingPageView.create({
        data: {
          path,
          referrer,
          utmSource,
          utmMedium,
          utmCampaign,
          sessionId,
          userAgent,
          ipHash,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record page view: ${(err as Error).message}`);
    }
  }

  private deriveSessionId({ ip, userAgent }: { ip?: string | null; userAgent?: string | null }) {
    const raw = `${ip || ''}|${userAgent || ''}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  private hashIp(ip: string) {
    return createHash('sha256').update(ip).digest('hex').slice(0, 32);
  }

  async getOverview(since: Date) {
    const [pv, uv, rows] = await Promise.all([
      this.prisma.landingPageView.count({ where: { createdAt: { gte: since } } }),
      this.prisma.landingPageView.groupBy({
        by: ['sessionId'],
        where: { createdAt: { gte: since }, sessionId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.landingPageView.findMany({
        where: { createdAt: { gte: since } },
        select: { sessionId: true, path: true, utmSource: true, referrer: true },
      }),
    ]);

    return {
      pv,
      uv: uv.length,
      entryCount: rows.filter((r) => !r.referrer).length,
    };
  }

  async getTimeSeries(since: Date, days: number) {
    const rows = await this.prisma.landingPageView.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, sessionId: true },
    });

    const buckets = new Array(days).fill(0).map((_, i) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (days - 1 - i));
      return { date: date.toISOString().slice(0, 10), pv: 0, uvSet: new Set<string>() };
    });

    for (const r of rows) {
      const d = r.createdAt.toISOString().slice(0, 10);
      const idx = buckets.findIndex((b) => b.date === d);
      if (idx >= 0) {
        buckets[idx].pv += 1;
        if (r.sessionId) buckets[idx].uvSet.add(r.sessionId);
      }
    }

    return buckets.map((b) => ({ date: b.date, pv: b.pv, uv: b.uvSet.size }));
  }

  async getTopPaths(since: Date, limit = 5) {
    const rows = await this.prisma.landingPageView.groupBy({
      by: ['path'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({ path: r.path, count: r._count._all }));
  }

  async getTopSources(since: Date, limit = 5) {
    const rows = await this.prisma.landingPageView.findMany({
      where: { createdAt: { gte: since } },
      select: { referrer: true, utmSource: true, sessionId: true },
    });

    const map = new Map<string, { pv: number; uvSet: Set<string> }>();
    for (const r of rows) {
      const source = r.utmSource || this.normalizeReferrer(r.referrer) || '直接访问';
      const entry = map.get(source) || { pv: 0, uvSet: new Set<string>() };
      entry.pv += 1;
      if (r.sessionId) entry.uvSet.add(r.sessionId);
      map.set(source, entry);
    }

    return Array.from(map.entries())
      .map(([source, v]) => ({ source, pv: v.pv, uv: v.uvSet.size }))
      .sort((a, b) => b.pv - a.pv)
      .slice(0, limit);
  }

  private normalizeReferrer(referrer: string | null): string | null {
    if (!referrer) return null;
    try {
      const u = new URL(referrer);
      return u.hostname;
    } catch {
      return null;
    }
  }
}
