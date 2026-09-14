import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlaceholderPage } from '../../../shared/components/PlaceholderPage';

interface PointsRow {
  customer: string;
  delta: number;
  reason: string;
  balance: number;
  at: string;
}

const columns: ColumnsType<PointsRow> = [
  { title: '客户', dataIndex: 'customer', key: 'customer', width: 160 },
  {
    title: '变动',
    dataIndex: 'delta',
    key: 'delta',
    width: 100,
    render: (delta: number) => (
      <span style={{ color: delta >= 0 ? '#52c41a' : '#f5222d', fontWeight: 600 }}>
        {delta >= 0 ? `+${delta}` : delta}
      </span>
    ),
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: 180,
    render: (reason: string) => <Tag>{reason}</Tag>,
  },
  { title: '余额', dataIndex: 'balance', key: 'balance', width: 100 },
  { title: '时间', dataIndex: 'at', key: 'at', width: 180 },
];

const dataSource: PointsRow[] = [
  {
    customer: '演示顾客',
    delta: 100,
    reason: '注册欢迎积分',
    balance: 100,
    at: '2026-09-13 10:20',
  },
  { customer: '王女士', delta: 200, reason: '订单奖励', balance: 320, at: '2026-09-12 16:05' },
  { customer: '李先生', delta: -150, reason: '积分兑换', balance: 70, at: '2026-09-12 11:30' },
  { customer: '赵女士', delta: 100, reason: '注册欢迎积分', balance: 100, at: '2026-09-11 09:15' },
];

/** 会员积分：PointsLedger 幂等记账流水 */
export function MemberPointsPage() {
  return (
    <PlaceholderPage<PointsRow>
      title="会员积分"
      description="会员积分流水——PointsLedger 幂等记账（注册欢迎积分 / 订单奖励 / 兑换扣减），余额由流水累计，Contact.pointsBalance 为快照。"
      hint="积分模型与幂等键已建（PointsLedger）；积分记录 / 加减分 / 核销与兑换模型 API 待补（Phase 2.5 M5）。"
      columns={columns}
      dataSource={dataSource}
    />
  );
}
