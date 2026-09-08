import { Tag } from 'antd';

const colorMap: Record<string, string> = {
  DRAFT: 'default',
  ACTIVE: 'green',
  ARCHIVED: 'orange',
};

const labelMap: Record<string, string> = {
  DRAFT: '草稿',
  ACTIVE: '上架',
  ARCHIVED: '已下架',
};

export function ProductStatusTag({ status }: { status: string }) {
  return <Tag color={colorMap[status] || 'default'}>{labelMap[status] || status}</Tag>;
}
