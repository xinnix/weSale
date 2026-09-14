import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 当前侧边栏成员装饰器（Member JWT payload）
 * MemberJwtGuard 会把 { userId, corpId } 挂到 req.member
 * 用法：@CurrentMember()(member) 或 @CurrentMember('userId')
 */
export const CurrentMember = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const member = request.member;
    return data ? member?.[data] : member;
  },
);
