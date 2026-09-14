import { Injectable } from '@nestjs/common';

/**
 * 语义标签条目（Contact.tags 的 SSOT 结构）
 * source 取值：CHANNEL（渠道/注册来源）/ LIVECODE（活码归因）/ BEHAVIOR（订单行为实时推导）
 */
export interface TagItem {
  name: string;
  source: 'CHANNEL' | 'LIVECODE' | 'BEHAVIOR';
  refId?: string; // 关联业务 id：liveCodeId / orderId / productId
  at: string; // ISO 时间
}

/** 行为标签推导的订单输入（只取推导所需字段） */
export interface BehaviorOrderInput {
  status: string;
  totalAmountFen: number;
  paidAt?: Date | null;
  product?: { category?: string | null } | null;
}

/**
 * 语义标签引擎（第一里程碑 V1）
 * - 行为标签：由完整订单历史实时推导（不落库，订单即事实源）
 * - 渠道/活码标签：已落库在 Contact.tags，读取时合并返回
 */
@Injectable()
export class SidebarTagsService {
  private readonly highValueFen = 10_000; // 单笔 ≥ ¥100 视为高客单价（后续 DB 化配置）
  private readonly sleepDays = 90; // >90 天未购视为沉睡客户

  deriveBehaviorTags(orders: BehaviorOrderInput[], now = new Date()): TagItem[] {
    const paid = orders.filter((o) => o.status === 'PAID' || o.status === 'COMPLETED');
    if (paid.length === 0) return [];

    const tags: TagItem[] = [];
    const at = now.toISOString();

    const lastPaid = paid.reduce(
      (maxDate, o) => (o.paidAt && o.paidAt.getTime() > maxDate.getTime() ? o.paidAt : maxDate),
      paid[0].paidAt ?? now,
    );
    const daysSinceLast = Math.max(
      0,
      Math.floor((now.getTime() - lastPaid.getTime()) / 86_400_000),
    );

    if (paid.length === 1 && daysSinceLast <= 30) {
      tags.push({ name: '首购新客', source: 'BEHAVIOR', at });
    }
    if (paid.length >= 2) {
      tags.push({ name: '复购常客', source: 'BEHAVIOR', at });
    }

    const maxOrderFen = Math.max(...paid.map((o) => o.totalAmountFen));
    if (maxOrderFen >= this.highValueFen) {
      tags.push({ name: '高客单价', source: 'BEHAVIOR', at });
    }

    if (daysSinceLast > this.sleepDays) {
      tags.push({ name: '沉睡客户', source: 'BEHAVIOR', at });
    }

    // 品类偏好：下单最多的产品类目
    const categoryCount = new Map<string, number>();
    for (const o of paid) {
      const cat = o.product?.category;
      if (cat) categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
    }
    if (categoryCount.size > 0) {
      let top: { name: string; count: number } | null = null;
      for (const [name, count] of categoryCount) {
        if (!top || count > top.count) top = { name, count };
      }
      if (top) tags.push({ name: `偏好${top.name}`, source: 'BEHAVIOR', at });
    }

    return tags;
  }

  /** 合并落库标签（渠道/活码）与实时行为标签（行为在前，渠道在后保持稳定） */
  merge(existing: TagItem[], behavior: TagItem[]): TagItem[] {
    return [...behavior, ...existing];
  }
}
