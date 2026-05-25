// apps/admin/src/modules/role/pages/RoleListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTable, useUpdate } from '@refinedev/core';
import { List } from '@refinedev/antd';
import { Table, Button, Modal, Form, Input, Space, Tag, Card, Row, Col, App } from 'antd';
import { SearchOutlined, TeamOutlined, KeyOutlined } from '@ant-design/icons';
import { RoleForm } from '../components/RoleForm';

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  level: number;
  isSystem: boolean;
  createdAt: Date;
  _count: {
    users: number;
    permissions: number;
  };
}

/**
 * 角色管理页面
 *
 * 系统固定四种角色，不允许创建或删除：
 * - 超级管理员 (super_admin)
 * - 管理员 (department_admin)
 * - 处理员 (handler)
 * - 普通用户 (user)
 */
export const RoleListPage = () => {
  const navigate = useNavigate();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Role | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const { mutate: update } = useUpdate();
  const { tableQuery } = useTable<Role>({
    resource: 'role',
    pagination: {
      currentPage: 1,
      pageSize: 50, // 显示所有角色
      mode: 'server',
    },
    filters: {
      initial: searchText
        ? [{ field: 'search', operator: 'contains', value: searchText } as any]
        : [],
    },
  });

  const result = tableQuery.data;
  const query = tableQuery;

  const handleEdit = (record: Role) => {
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      // 不允许修改 slug 和 level
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 只允许修改 name 和 description
      if (editingRecord) {
        update(
          {
            resource: 'role',
            id: editingRecord.id,
            values: {
              name: values.name,
              description: values.description,
            },
          },
          {
            onSuccess: () => {
              message.success('更新成功');
              setIsModalVisible(false);
              query.refetch();
            },
            onError: (error: any) => {
              message.error('更新失败: ' + (error.message || '未知错误'));
            },
          },
        );
      }
    } catch (error) {
      console.error('Form validation error:', error);
    }
  };

  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 150,
      render: (name: string, record: Role) => (
        <Space>
          <span>{name}</span>
          {record.isSystem && <Tag color="blue">系统</Tag>}
        </Space>
      ),
    },
    {
      title: '标识',
      dataIndex: 'slug',
      width: 150,
      render: (slug: string) => <Tag color="default">{slug}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: '层级',
      dataIndex: 'level',
      width: 100,
      render: (level: number) => (
        <Tag color={level === 0 ? 'red' : level < 50 ? 'orange' : 'default'}>{level}</Tag>
      ),
    },
    {
      title: '用户数',
      dataIndex: '_count',
      width: 100,
      render: (count: Role['_count']) => (
        <Tag icon={<TeamOutlined />} color="blue">
          {count.users}
        </Tag>
      ),
    },
    {
      title: '权限数',
      dataIndex: '_count',
      width: 100,
      render: (count: Role['_count']) => (
        <Tag icon={<KeyOutlined />} color="green">
          {count.permissions}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Role) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => navigate(`/roles/${record.id}`)}
            icon={<KeyOutlined />}
          >
            权限
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <List>
        <Card>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>角色管理</h1>
              <div style={{ fontSize: 14, color: '#999', marginTop: 8 }}>
                系统固定四种角色：超级管理员、管理员、处理员、普通用户
              </div>
            </Col>
          </Row>

          {/* Search */}
          <Input
            placeholder="搜索角色名称或标识"
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
            loading={query.isLoading}
            pagination={false}
          />

          <Modal
            title="编辑角色"
            open={isModalVisible}
            onOk={handleSubmit}
            onCancel={() => setIsModalVisible(false)}
            okText="确定"
            cancelText="取消"
            width={600}
          >
            <RoleForm form={form} isEdit={true} isSystemRole={true} />
          </Modal>
        </Card>
      </List>
    </div>
  );
};
