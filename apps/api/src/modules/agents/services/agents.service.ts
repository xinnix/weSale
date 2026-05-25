import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/base.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AgentsService extends BaseService<'agent'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'agent');
  }

  async findOneWithKey(id: string) {
    return this.model.findUnique({ where: { id } });
  }

  async findActive() {
    return this.model.findMany({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        difyAppType: true,
        sort: true,
      },
    });
  }

  maskApiKey(key: string): string {
    if (!key || key.length <= 4) return '****';
    return `****${key.slice(-4)}`;
  }

  maskAgentRecord(record: any): any {
    if (!record) return record;
    return {
      ...record,
      difyApiKey: this.maskApiKey(record.difyApiKey),
    };
  }

  maskAgentRecords(records: any[]): any[] {
    return records.map((r) => this.maskAgentRecord(r));
  }
}
