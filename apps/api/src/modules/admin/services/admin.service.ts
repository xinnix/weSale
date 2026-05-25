import { BaseService } from '../../../common/base.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Admin Service
 *
 * Manages Admin users (backend management users)
 * Separate from User service (miniapp users)
 */
export class AdminService extends BaseService<'Admin'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'Admin');
  }
}
