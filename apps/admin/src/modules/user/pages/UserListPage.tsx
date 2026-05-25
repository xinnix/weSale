// apps/admin/src/modules/user/pages/UserListPage.tsx
import { useState, useEffect } from 'react';
import { useTable } from '@refinedev/core';
import { List } from '@refinedev/antd';
import { Table, Input, Tag, Card, Row, Col } from 'antd';
import { SearchOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';

interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export const UserListPage = () => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 防抖：延迟 500ms 更新搜索词
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [searchText]);

  const { tableQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useTable<User>({
    resource: 'user',
    pagination: {
      currentPage: 1,
      pageSize: 10,
      mode: 'server',
    },
    filters: {
      initial: debouncedSearch
        ? ([
            {
              field: 'search',
              operator: 'eq',
              value: debouncedSearch,
            },
          ] as any)
        : [],
    },
  });

  const result = tableQuery.data;
  const query = tableQuery;

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      render: (id: string) => (
        <span style={{ fontSize: 12, color: '#999' }}>{id.slice(0, 8)}...</span>
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 120,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 130,
      render: (phone: string) => phone || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    },
    {
      title: '姓名',
      dataIndex: 'firstName',
      width: 100,
      render: (firstName: string, record: User) => {
        const fullName = [firstName, record.lastName].filter(Boolean).join(' ');
        return fullName || '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 90,
      align: 'center' as const,
      render: (isActive: boolean) => (
        <Tag
          icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}
          color={isActive ? 'success' : 'error'}
        >
          {isActive ? '激活' : '停用'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 160,
      render: (date: Date) => (date ? new Date(date).toLocaleString('zh-CN') : '从未登录'),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      <List>
        <Card>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>用户管理</h1>
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="搜索用户名、邮箱或手机号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
          </div>

          <Table
            columns={columns}
            rowKey="id"
            dataSource={(result as any)?.data || []}
            loading={query.isLoading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: (result as any)?.total || 0,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, newPageSize) => {
                setCurrentPage(page);
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                  setCurrentPage(1);
                }
              },
            }}
          />
        </Card>
      </List>
    </div>
  );
};
