import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/base.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProductService extends BaseService<'product'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'product');
  }

  async findBySlug(slug: string) {
    return this.model.findUnique({ where: { slug } });
  }

  async findActive() {
    return this.model.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: { sort: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        coverImage: true,
        priceFen: true,
        originalPriceFen: true,
        billingCycle: true,
        features: true,
        category: true,
        trialDays: true,
      },
    });
  }

  formatForPrompt(products: any[]): string {
    if (!products.length) return '（暂无可用产品）';
    return products
      .map(
        (p) =>
          `- ${p.slug}: "${p.name}" - ${p.shortDescription || ''} 价格：${(p.priceFen / 100).toFixed(2)}元。${Array.isArray(p.features) ? '特点：' + (p.features as string[]).join('、') + '。' : ''}`,
      )
      .join('\n');
  }
}
