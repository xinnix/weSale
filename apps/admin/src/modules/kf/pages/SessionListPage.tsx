import { useTable } from '@refinedev/core';
import { List } from '@refinedev/antd';
import { Table, Card, Input, Space, Select, App } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionStateTag, IntentLevelTag } from '../components/SessionStateTag';

interface Session {
  id: string;
  sessionKey: string;
  openKfId: string;
  state: string;
  intentLevel: string;
  turnCount: number;
  lastActiveAt: string;
  contact?: {
    id: string;
    nickname?: string;
    openId: string;
  };
}

const SESSION_STATES = [
  'GREETING',
  'NEEDS_DISCOVERY',
  'PRODUCT_MATCH',
  'OBJECTION_HANDLING',
  'CLOSING',
  'CONVERTED',
  'ESCALATED',
  'TIMED_OUT',
];

export const SessionListPage = () => {
  const [searchText, setSearchText] = useState('');
  const [stateFilter, setStateFilter] = useState<string | undefined>();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const { tableQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useTable<Session>({
    resource: 'wechatKf.session',
    pagination: { currentPage: 1, pageSize: 20, mode: 'server' },
    filters: {
      initial: [
        ...(searchText
          ? [{ field: 'search', operator: 'contains' as const, value: searchText } as any]
          : []),
        ...(stateFilter
          ? [{ field: 'state', operator: 'eq' as const, value: stateFilter } as any]
          : []),
      ],
    },
  });

  const result = tableQuery.data;

  const handleTakeOver = async (session: Session) => {
    try {
      await (window as any).__trpcClient?.wechatKf?.session?.takeOver?.mutate({ id: session.id });
      message.success('已接手会话');
      tableQuery.refetch();
    } catch (e: any) {
      message.error('接手失败: ' + (e.message || '未知错误'));
    }
  };

  const columns = [
    {
      title: '访客',
      width: 150,
      render: (_: any, record: Session) =>
        record.contact?.nickname || record.contact?.openId?.slice(-8) || '-',
    },
    {
      title: '客服账号',
      dataIndex: 'openKfId',
      width: 160,
      render: (id: string) => id?.slice(-12) || '-',
    },
    {
      title: '状态',
      dataIndex: 'state',
      width: 100,
      render: (state: string) => <SessionStateTag state={state} />,
    },
    {
      title: '意向度',
      dataIndex: 'intentLevel',
      width: 90,
      render: (level: string) => <IntentLevelTag level={level} />,
    },
    {
      title: '轮次',
      dataIndex: 'turnCount',
      width: 70,
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActiveAt',
      width: 180,
      render: (date: string) => (date ? new Date(date).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      width: 160,
      render: (_: any, record: Session) => (
        <Space>
          <a onClick={() => navigate(`/kf/sessions/${record.id}`)}>进入会话</a>
          {['GREETING', 'NEEDS_DISCOVERY', 'PRODUCT_MATCH', 'OBJECTION_HANDLING'].includes(
            record.state,
          ) && (
            <a onClick={() => handleTakeOver(record)} style={{ color: '#ff4d4f' }}>
              接手
            </a>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <List>
        <Card>
          <h1 style={{ margin: '0 0 16px 0', fontSize: 24, fontWeight: 'bold' }}>会话管理</h1>

          <Space style={{ marginBottom: 16 }}>
            <Input
              placeholder="搜索访客昵称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            <Select
              placeholder="会话状态"
              value={stateFilter}
              onChange={setStateFilter}
              style={{ width: 140 }}
              allowClear
              options={SESSION_STATES.map((s) => ({ value: s, label: s }))}
            />
          </Space>

          <Table
            columns={columns}
            rowKey="id"
            dataSource={result?.data || []}
            loading={tableQuery.isLoading}
            pagination={{
              current: currentPage,
              pageSize,
              total: result?.total || 0,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </Card>
      </List>
    </div>
  );
};
