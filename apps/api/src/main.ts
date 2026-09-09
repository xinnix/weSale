// apps/api/src/main.ts
import path from 'path';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/http-exception.filter';

import { PrismaService } from './prisma/prisma.service';
import { FileStorageService } from './shared/services/file-storage.service';
import { OrderService } from './modules/product/services/order.service';
import { WechatPayService } from './modules/payment/services/wechat-pay.service';
import { WechatKfApiService } from './modules/wechat-kf/services/kf-api.service';
import { WecomApiService } from './modules/wecom/services/wecom-api.service';
import { appRouter } from './trpc/app.router';
import {
  createContext,
  setPrismaService,
  setFileStorageService,
  setOrderService,
  setWechatPayService,
  setWechatKfApiService,
  setWecomApiService,
  setAppInstance,
} from './trpc/trpc';
import * as trpcExpress from '@trpc/server/adapters/express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { json } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // 启用 NestJS 优雅关闭钩子，确保 watch 模式重启时旧进程完全释放端口
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Security headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS with production validation
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  if (isProduction && corsOrigin === '*') {
    console.warn('CORS_ORIGIN is "*" in production. This is insecure.');
  }
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Body size limit + raw body capture for WeChat callbacks (XML body)
  app.use(
    json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString();
      },
    }),
  );
  // 额外捕获 text/xml 类型的原始 body（微信回调用 XML）
  app.use(express.text({ type: 'text/xml', limit: '10mb' }));

  // 配置静态文件服务（用于访问上传的文件）
  const uploadPath = process.env.UPLOAD_PATH || path.resolve(__dirname, '../../../uploads');
  app.use(express.static(uploadPath));

  // Set global prefix for all REST API routes
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Set up tRPC middleware
  const prismaService = app.get(PrismaService);
  setPrismaService(prismaService.extended || prismaService);

  const fileStorageService = app.get(FileStorageService);
  setFileStorageService(fileStorageService);

  // tRPC 层使用的业务服务注册（修复模块级 new 绕过 DI 的问题）
  setOrderService(app.get(OrderService));
  setWechatPayService(app.get(WechatPayService));
  setWechatKfApiService(app.get(WechatKfApiService));
  setWecomApiService(app.get(WecomApiService));

  setAppInstance(app);

  (app as any).use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: (opts) => createContext(opts),
    }),
  );

  await app.listen(port);

  console.log(`Backend started: http://localhost:${port}/trpc`);
  console.log(`REST API: http://localhost:${port}/api`);
}
bootstrap();
