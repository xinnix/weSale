import { useTable } from '@refinedev/core';
import { List } from '@refinedev/antd';
import { Table, Card, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContactStatusTag, IntentLevelTag } from '../components/SessionStateTag';

interface Contact {
  id: string;
  openId: string;
  nickname?: string;
  phone?: string;
  status: string;
  intentLevel: string;
  createdAt: string;
}

export const ContactListPage = () => {
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const { tableQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useTable<Contact>({
    resource: 'wechatKf.contact',
    pagination: { currentPage: 1, pageSize: 20, mode: 'server' },
    filters: {
      initial: searchText
        ? [{ field: 'search', operator: 'contains', value: searchText } as any]
        : [],
    },
  });

  const result = tableQuery.data;

  const columns = [
    {
      title: '昵称',
      dataIndex: 'nickname',
      width: 150,
      render: (name: string, record: Contact) => name || record.openId?.slice(-8) || '-',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 130,
      render: (phone: string) => phone || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: string) => <ContactStatusTag status={status} />,
    },
    {
      title: '意向度',
      dataIndex: 'intentLevel',
      width: 90,
      render: (level: string) => <IntentLevelTag level={level} />,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, record: Contact) => (
        <a onClick={() => navigate(`/kf/sessions?contactId=${record.id}`)}>查看会话</a>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <List>
        <Card>
          <h1 style={{ margin: '0 0 16px 0', fontSize: 24, fontWeight: 'bold' }}>客户管理</h1>

          <Input
            placeholder="搜索昵称、手机号、openId"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300, marginBottom: 16 }}
            allowClear
          />

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
