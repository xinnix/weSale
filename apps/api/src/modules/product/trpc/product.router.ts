import { z } from 'zod';
import { CreateProductSchema, UpdateProductSchema } from '@opencode/shared';
import { createCrudRouterWithCustom } from '../../../trpc/trpc.helper';
import { permissionProcedure, publicProcedure } from '../../../trpc/trpc';
import { NotFoundBusinessException, ConflictException, ErrorCodes } from '../../../core/exceptions';

const productGetManySchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
    search: z.string().optional(),
    where: z.any().optional(),
    orderBy: z.any().optional(),
  })
  .optional();

export const productRouter = createCrudRouterWithCustom(
  'Product',
  {
    create: CreateProductSchema,
    update: UpdateProductSchema,
  },
  () => ({
    getMany: permissionProcedure('product', 'read')
      .input(productGetManySchema)
      .query(async ({ ctx, input }) => {
        const page = input?.page ?? 1;
        const pageSize = input?.limit ?? input?.pageSize ?? 10;
        const skip = (page - 1) * pageSize;

        const where: any =
          input?.where && typeof input.where === 'object' ? { ...input.where } : {};
        where.deletedAt = null;

        let searchTerm = input?.search;
        const whereSearch = where.search;
        if (!searchTerm && whereSearch) {
          if (typeof whereSearch === 'string') {
            searchTerm = whereSearch;
          } else if (typeof whereSearch?.contains === 'string') {
            searchTerm = whereSearch.contains;
          }
        }
        delete where.search;

        if (searchTerm) {
          where.OR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { slug: { contains: searchTerm, mode: 'insensitive' } },
          ];
        }

        const [items, total] = await Promise.all([
          ctx.prisma.product.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: input?.orderBy || { sort: 'asc' },
          }),
          ctx.prisma.product.count({ where }),
        ]);

        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
      }),

    getOne: permissionProcedure('product', 'read')
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const product = await ctx.prisma.product.findUnique({
          where: { id: input.id, deletedAt: null },
        });
        if (!product)
          throw new NotFoundBusinessException('Product', input.id, ErrorCodes.PRODUCT_NOT_FOUND);
        return product;
      }),

    create: permissionProcedure('product', 'create')
      .input(
        z.object({
          data: CreateProductSchema,
          include: z.any().optional(),
          select: z.any().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { data } = input;
        const existing = await ctx.prisma.product.findUnique({ where: { slug: data.slug } });
        if (existing)
          throw new ConflictException(
            'Product slug already exists',
            ErrorCodes.PRODUCT_SLUG_EXISTS,
          );

        return ctx.prisma.product.create({
          data: {
            ...data,
            features: data.features ?? [],
            images: data.images ?? [],
            createdById: ctx.user?.id,
            updatedById: ctx.user?.id,
          },
          include: input.include,
          select: input.select,
        });
      }),

    update: permissionProcedure('product', 'update')
      .input(
        z.object({
          id: z.string(),
          data: UpdateProductSchema,
          include: z.any().optional(),
          select: z.any().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, data } = input;
        const existing = await ctx.prisma.product.findUnique({ where: { id } });
        if (!existing)
          throw new NotFoundBusinessException('Product', id, ErrorCodes.PRODUCT_NOT_FOUND);

        if (data.slug && data.slug !== existing.slug) {
          const slugConflict = await ctx.prisma.product.findUnique({ where: { slug: data.slug } });
          if (slugConflict)
            throw new ConflictException(
              'Product slug already exists',
              ErrorCodes.PRODUCT_SLUG_EXISTS,
            );
        }

        return ctx.prisma.product.update({
          where: { id },
          data: { ...data, updatedById: ctx.user?.id },
          include: input.include,
          select: input.select,
        });
      }),

    delete: permissionProcedure('product', 'delete')
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.product.update({
          where: { id: input.id },
          data: { deletedAt: new Date() },
        });
      }),

    deleteMany: permissionProcedure('product', 'delete')
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.product.updateMany({
          where: { id: { in: input.ids } },
          data: { deletedAt: new Date() },
        });
      }),

    getActive: publicProcedure.query(async ({ ctx }) => {
      return ctx.prisma.product.findMany({
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
    }),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ ctx, input }) => {
        const product = await ctx.prisma.product.findUnique({
          where: { slug: input.slug, deletedAt: null },
        });
        if (!product)
          throw new NotFoundBusinessException('Product', input.slug, ErrorCodes.PRODUCT_NOT_FOUND);
        return product;
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
