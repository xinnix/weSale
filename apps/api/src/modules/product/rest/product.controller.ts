import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('products')
export class ProductController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('active')
  async getActive(@Req() req: Request, @Res() res: Response) {
    const products = await this.prisma.product.findMany({
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
    return res.json({ data: products });
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string, @Res() res: Response) {
    const product = await this.prisma.product.findUnique({
      where: { slug, deletedAt: null },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json({ data: product });
  }
}
