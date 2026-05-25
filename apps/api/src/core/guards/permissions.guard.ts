import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../modules/auth/decorators/decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Check if user has the required permission
    const permissionString = `${requiredPermission.resource}:${requiredPermission.action}`;

    // Get all user permissions from roles
    const userPermissions = new Set<string>();
    user.roles?.forEach((userRole: any) => {
      userRole.role?.permissions?.forEach((rolePermission: any) => {
        userPermissions.add(
          `${rolePermission.permission.resource}:${rolePermission.permission.action}`,
        );
      });
    });

    return userPermissions.has(permissionString);
  }
}
