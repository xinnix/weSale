import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

interface MemberPayload {
  sub: string; // 企微成员 userid
  corpId: string;
  type: 'member';
}

/**
 * 侧边栏成员身份守卫（不扩 Passport JwtStrategy，独立于 Admin/User 身份面）
 * - 验签 JWT + 校验 type==='member'（Admin/User token 一律拒绝）
 * - 通过后把 { userId, corpId } 挂到 req.member，供 @CurrentMember 读取
 */
@Injectable()
export class MemberJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request?.headers?.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少 Bearer token');
    }

    const token = authHeader.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
      const payload = jwt.verify(token, secret) as MemberPayload;

      if (payload.type !== 'member' || !payload.sub || !payload.corpId) {
        throw new Error('非 member token');
      }

      request.member = { userId: payload.sub, corpId: payload.corpId };
      return true;
    } catch {
      throw new UnauthorizedException('无效的 Member token');
    }
  }
}
