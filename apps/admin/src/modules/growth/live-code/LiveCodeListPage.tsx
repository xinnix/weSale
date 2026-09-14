import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlaceholderPage } from '../../../shared/components/PlaceholderPage';

interface LiveCodeRow {
  name: string;
  state: string;
  members: string;
  autoTags: string;
  status: 'ACTIVE' | 'DISABLED';
  added: number;
}

const columns: ColumnsType<LiveCodeRow> = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 180 },
  {
    title: 'state',
    dataIndex: 'state',
    key: 'state',
    width: 130,
    render: (v: string) => <code>{v}</code>,
  },
  { title: '接待成员', dataIndex: 'members', key: 'members', width: 160 },
  { title: '自动标签', dataIndex: 'autoTags', key: 'autoTags', width: 160 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (s: LiveCodeRow['status']) =>
      s === 'ACTIVE' ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>,
  },
  { title: '添加人数', dataIndex: 'added', key: 'added', width: 100 },
];

const dataSource: LiveCodeRow[] = [
  {
    name: '618 包裹卡',
    state: 'lc_7f2a9x',
    members: '张三、李四',
    autoTags: '来自包裹卡',
    status: 'ACTIVE',
    added: 156,
  },
  {
    name: '门店立牌·北京',
    state: 'lc_k3m8bq',
    members: '王五',
    autoTags: '来自门店',
    status: 'ACTIVE',
    added: 82,
  },
  {
    name: '朋友圈广告',
    state: 'lc_p9x2cd',
    members: '张三',
    autoTags: '来自广告',
    status: 'DISABLED',
    added: 41,
  },
];

/** 活码管理：企微「联系我」活码（F8 站外获客） */
export function LiveCodeListPage() {
  return (
    <PlaceholderPage<LiveCodeRow>
      title="活码管理"
      description="企微「联系我」活码——投放于包裹卡 / 门店 / 广告等物料，客户扫码添加好友后按 state 归因渠道来源并自动打标签（企微原生 mark_tags + Contact.tags 双写）。"
      hint="schema 与企微 API 封装（add_contact_way / del_contact_way）已就绪，回调归因分发已实现；活码的新增 / 编辑 / 停用管理 API 待补。"
      columns={columns}
      dataSource={dataSource}
    />
  );
}
