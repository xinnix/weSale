import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import * as path from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../shared/services/redis.service';
import { WecomApiService } from '../../wecom/services/wecom-api.service';

// 企微临时素材 3 天过期，缩略图缓存留 2.5 天裕度（与 KF 卡片封面同策略）
const THUMB_TTL_MS = 2.5 * 24 * 3600 * 1000;

/**
 * 侧边栏产品卡片：选在售商品 → 组装小程序卡片发送参数
 * （封面 → 企微临时素材 thumb_media_id，发送仍由前端 ww.sendChatMessage 完成）
 */
@Injectable()
export class SidebarProductsService {
  private readonly logger = new Logger(SidebarProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wecomApi: WecomApiService,
    private readonly redis: RedisService,
  ) {}

  /** 在售商品列表 */
  async listProducts() {
    return this.prisma.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: { sort: 'asc' },
      select: { id: true, name: true, priceFen: true, slug: true },
    });
  }

  /** 组装某商品的小程序卡片参数（appid/title/pagePath/thumbMediaId） */
  async getProductCard(productId: string, corpId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE', deletedAt: null },
    });
    if (!product) throw new NotFoundException('商品不存在或未上架');

    const appid = this.config.get<string>('MINIAPP_APPID', '');
    if (!appid) throw new NotFoundException('未配置 MINIAPP_APPID（小程序 appid）');

    const thumbMediaId = await this.resolveThumbMediaId(corpId, product.id, product.coverImage);

    return {
      appid,
      title: product.name,
      pagePath: `pages/product/detail?slug=${product.slug}`,
      thumbMediaId,
    };
  }

  /** 封面图 → 企微临时素材 thumb_media_id（Redis 缓存 2.5 天） */
  private async resolveThumbMediaId(
    corpId: string,
    productId: string,
    coverImage?: string | null,
  ): Promise<string> {
    const cacheKey = `sidebar:card:thumb:${productId}`;
    try {
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) return cached;
    } catch {
      /* Redis 降级 */
    }

    const buffer = await this.downloadCover(coverImage);
    const secret = this.config.get<string>('WX_WORK_SECRET', '');
    const token = await this.wecomApi.getAccessToken(corpId, secret);
    const { media_id } = await this.wecomApi.uploadTempImage(token, buffer, 'cover.jpg');
    this.logger.log(`[product-card] ${productId} 封面上传成功 media_id=${media_id.slice(0, 8)}…`);

    try {
      await this.redis.set(cacheKey, media_id, THUMB_TTL_MS);
    } catch {
      /* 降级 */
    }
    return media_id;
  }

  /** 下载商品封面（相对路径走站点域名；失败回退默认封面） */
  private async downloadCover(coverImage?: string | null): Promise<Buffer> {
    const fallbackPath = path.resolve(__dirname, '../../miniapp/src/static/share-default.png');
    try {
      if (!coverImage) throw new Error('商品无封面图');
      const assetBase = new URL(
        this.config.get<string>('SIDEBAR_EXTERNAL_URL', '') || 'https://localhost',
      ).origin;
      const target = coverImage.startsWith('http')
        ? coverImage
        : new URL(coverImage, assetBase).href;
      const res = await fetch(target);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error('空封面');
      return buf;
    } catch (err: any) {
      this.logger.warn(`封面下载失败（用默认图兜底）: ${err.message}`);
      return readFileSync(fallbackPath);
    }
  }
}
