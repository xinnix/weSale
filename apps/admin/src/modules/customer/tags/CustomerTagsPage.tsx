import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlaceholderPage } from '../../../shared/components/PlaceholderPage';

interface TagRow {
  name: string;
  source: string;
  sourceLabel: string;
  customers: number;
  updatedAt: string;
}

const columns: ColumnsType<TagRow> = [
  { title: '标签名', dataIndex: 'name', key: 'name', width: 200 },
  {
    title: '来源类型',
    dataIndex: 'sourceLabel',
    key: 'sourceLabel',
    width: 160,
    render: (label: string, record) => (
      <Tag
        color={
          record.source === 'LIVECODE' ? 'green' : record.source === 'CHANNEL' ? 'blue' : 'geekblue'
        }
      >
        {label}
      </Tag>
    ),
  },
  { title: '关联客户数', dataIndex: 'customers', key: 'customers', width: 120 },
  { title: '最近更新', dataIndex: 'updatedAt', key: 'updatedAt', width: 160 },
];

const dataSource: TagRow[] = [
  {
    name: '来自包裹卡',
    source: 'LIVECODE',
    sourceLabel: '活码',
    customers: 128,
    updatedAt: '2026-09-13',
  },
  {
    name: '来自门店物料',
    source: 'LIVECODE',
    sourceLabel: '活码',
    customers: 74,
    updatedAt: '2026-09-12',
  },
  {
    name: '高意向',
    source: 'BEHAVIOR',
    sourceLabel: '行为',
    customers: 42,
    updatedAt: '2026-09-13',
  },
  {
    name: '复购常客',
    source: 'BEHAVIOR',
    sourceLabel: '行为',
    customers: 36,
    updatedAt: '2026-09-13',
  },
  {
    name: '偏好咖啡',
    source: 'BEHAVIOR',
    sourceLabel: '行为',
    customers: 21,
    updatedAt: '2026-09-11',
  },
  {
    name: '沉睡客户',
    source: 'BEHAVIOR',
    sourceLabel: '行为',
    customers: 15,
    updatedAt: '2026-09-13',
  },
];

/** 客户标签：语义标签体系（Contact.tags SSOT） */
export function CustomerTagsPage() {
  return (
    <PlaceholderPage<TagRow>
      title="客户标签"
      description="语义标签体系——来源为渠道（注册来源 / 活码 state）与行为（消费历史实时推导），统一落库于 Contact.tags，侧边栏客户画像直接读取。"
      hint="行为/渠道标签的自动推导已随侧边栏画像就绪；标签库的增删改查与运营手动打标 API 待补。"
      columns={columns}
      dataSource={dataSource}
    />
  );
}
