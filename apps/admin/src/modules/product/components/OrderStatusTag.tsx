import { Tag } from 'antd';

const colorMap: Record<string, string> = {
  PENDING: 'default',
  PAID: 'green',
  COMPLETED: 'blue',
  REFUNDING: 'orange',
  REFUNDED: 'red',
  CANCELLED: 'default',
};

const labelMap: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  COMPLETED: '已完成',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
};

export function OrderStatusTag({ status }: { status: string }) {
  return <Tag color={colorMap[status] || 'default'}>{labelMap[status] || status}</Tag>;
}
