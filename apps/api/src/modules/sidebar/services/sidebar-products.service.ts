import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * 侧边栏产品卡片：选在售商品 → 组装小程序卡片参数
 * 注意：侧边栏 ww.sendChatMessage 的 miniprogram 参数是 img_url + page
 * （thumb_media_id/pagepath 是服务端 KF send_msg 的格式，两者不同）
 */
@Injectable()
export class SidebarProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 在售商品列表 */
  async listProducts() {
    return this.prisma.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: { sort: 'asc' },
      select: { id: true, name: true, priceFen: true, slug: true },
    });
  }

  /** 组装某商品的小程序卡片参数（appid/title/imgUrl/page） */
  async getProductCard(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE', deletedAt: null },
    });
    if (!product) throw new NotFoundException('商品不存在或未上架');

    const appid = this.config.get<string>('MINIAPP_APPID', '');
    if (!appid) throw new NotFoundException('未配置 MINIAPP_APPID（小程序 appid）');

    return {
      appid,
      title: product.name,
      imgUrl: product.coverImage,
      page: `pages/product/detail?slug=${product.slug}`,
    };
  }
}
