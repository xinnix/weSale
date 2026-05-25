import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// 控制器
import { AuthController } from './rest/auth.controller';

// 服务
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './services/jwt.strategy';

// 模块
import { WechatModule } from '../wechat/wechat.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any,
      },
      global: true,
    }),
    WechatModule,
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useClass: AuthService,
    },
    JwtStrategy,
  ],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
