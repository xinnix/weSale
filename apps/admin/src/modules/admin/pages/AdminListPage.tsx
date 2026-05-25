import { useState } from 'react';
import { useTable, useCreate, useUpdate, useDelete, useDeleteMany, useList } from '@refinedev/core';
import { List } from '@refinedev/antd';
import {
  Table,
  Button,
  Modal,
  Form,
  Space,
  App,
  Tag,
  Popconfirm,
  Card,
  Row,
  Col,
  Input,
  Select,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  StopOutlined,
  EyeOutlined,
  UserOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { AdminForm } from '../components/AdminForm';
import { useNavigate } from 'react-router-dom';
import { trpcClient } from '../../../shared/dataProvider/dataProvider';

interface AdminRole {
  id: string;
  name: string;
  slug: string;
  level: number;
}

interface AdminRecord {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isActive: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  roles: AdminRole[];
}

export const AdminListPage = () => {
  const navigate = useNavigate();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AdminRecord | null>(null);
  const [passwordRecord, setPasswordRecord] = useState<AdminRecord | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { message } = App.useApp();

  const { mutate: create } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: deleteOne } = useDelete();
  const { mutate: deleteMany } = useDeleteMany();

  // 处理删除单个管理员
  const handleDelete = (id: string) => {
    deleteOne(
      { resource: 'admin', id },
      {
        onSuccess: () => {
          message.success('删除成功');
          query.refetch();
        },
        onError: () => {
          message.error('删除失败');
        },
      },
    );
  };

  const { tableQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useTable<AdminRecord>({
    resource: 'admin',
    pagination: {
      currentPage: 1,
      pageSize: 10,
      mode: 'server',
    },
    filters: {
      initial: [
        ...(searchText
          ? [{ field: 'search', operator: 'contains' as const, value: searchText }]
          : []),
        ...(statusFilter !== undefined
          ? [{ field: 'isActive', operator: 'eq' as const, value: statusFilter }]
          : []),
      ],
    },
  });

  const result = tableQuery.data;
  const query = tableQuery;

  // 获取所有角色列表
  const { result: rolesResult } = useList({
    resource: 'role',
    pagination: { pageSize: 100 },
  });

  const allRoles = ((rolesResult as any)?.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    level: r.level,
    description: r.description,
  }));

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: AdminRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      roleIds: record.roles.map((r) => r.id),
    });
    setIsModalVisible(true);
  };

  const handleToggleActive = async (record: AdminRecord) => {
    try {
      await (trpcClient as any).admin.toggleActive.mutate({ id: record.id });
      message.success(record.isActive ? '已停用' : '已启用');
      query.refetch();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleResetPassword = (record: AdminRecord) => {
    setPasswordRecord(record);
    passwordForm.resetFields();
    setIsPasswordModalVisible(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      await (trpcClient as any).admin.resetPassword.mutate({
        adminId: passwordRecord!.id,
        newPassword: values.newPassword,
      });
      message.success('密码重置成功');
      setIsPasswordModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '重置失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { roleIds, ...adminData } = values;

      if (editingRecord) {
        // 更新管理员基本信息
        update(
          { resource: 'admin', id: editingRecord.id, values: adminData },
          {
            onSuccess: async () => {
              // 处理角色变更
              const currentRoleIds = editingRecord.roles.map((r) => r.id);
              const newRoleIds = roleIds || [];

              // 找出需要添加的角色
              const rolesToAdd = newRoleIds.filter((id: string) => !currentRoleIds.includes(id));
              // 找出需要移除的角色
              const rolesToRemove = currentRoleIds.filter((id) => !newRoleIds.includes(id));

              try {
                // 批量添加角色
                for (const roleId of rolesToAdd) {
                  await (trpcClient as any).admin.assignRole.mutate({
                    adminId: editingRecord.id,
                    roleId,
                  });
                }

                // 批量移除角色
                for (const roleId of rolesToRemove) {
                  await (trpcClient as any).admin.removeRole.mutate({
                    adminId: editingRecord.id,
                    roleId,
                  });
                }

                message.success('更新成功');
                setIsModalVisible(false);
                query.refetch();
              } catch (error: any) {
                message.error(error.message || '角色分配失败');
              }
            },
            onError: (error: any) => {
              message.error(error.message || '更新失败');
            },
          },
        );
      } else {
        // 创建管理员
        create(
          { resource: 'admin', values: adminData },
          {
            onSuccess: async (response: any) => {
              // 处理角色分配
              const newAdminId = response.data.id;
              const selectedRoleIds = roleIds || [];

              if (selectedRoleIds.length > 0) {
                try {
                  // 移除默认的 viewer 角色（如果存在）
                  const viewerRole = allRoles.find((r) => r.slug === 'viewer');
                  if (viewerRole && !selectedRoleIds.includes(viewerRole.id)) {
                    try {
                      await (trpcClient as any).admin.removeRole.mutate({
                        adminId: newAdminId,
                        roleId: viewerRole.id,
                      });
                    } catch {
                      // 忽略移除失败的情况（可能没有 viewer 角色）
                    }
                  }

                  // 分配用户选择的角色
                  for (const roleId of selectedRoleIds) {
                    await (trpcClient as any).admin.assignRole.mutate({
                      adminId: newAdminId,
                      roleId,
                    });
                  }

                  message.success('创建成功');
                  setIsModalVisible(false);
                  query.refetch();
                } catch (error: any) {
                  message.error(error.message || '角色分配失败');
                }
              } else {
                message.success('创建成功');
                setIsModalVisible(false);
                query.refetch();
              }
            },
            onError: (error: any) => {
              message.error(error.message || '创建失败');
            },
          },
        );
      }
    } catch (error) {
      console.error('Form validation error:', error);
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的管理员');
      return;
    }
    deleteMany(
      { resource: 'admin', ids: selectedRowKeys },
      {
        onSuccess: () => {
          message.success(`成功删除 ${selectedRowKeys.length} 个管理员`);
          setSelectedRowKeys([]);
          query.refetch();
        },
        onError: (error: any) => {
          message.error(error.message || '批量删除失败');
        },
      },
    );
  };

  const columns = [
    {
      title: '管理员',
      dataIndex: 'username',
      width: 200,
      render: (username: string, record: AdminRecord) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} src={record.avatar} />
          <span style={{ fontWeight: 500 }}>{username}</span>
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    },
    {
      title: '姓名',
      width: 120,
      render: (_: any, record: AdminRecord) => {
        const name = [record.lastName, record.firstName].filter(Boolean).join('');
        return name || '-';
      },
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 200,
      render: (roles: AdminRole[]) =>
        roles.length > 0 ? (
          roles.map((role) => (
            <Tag
              key={role.id}
              color={role.level <= 5 ? 'red' : role.level <= 10 ? 'blue' : 'default'}
            >
              {role.name}
            </Tag>
          ))
        ) : (
          <Tag>无角色</Tag>
        ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 90,
      render: (isActive: boolean, record: AdminRecord) => (
        <Button
          size="small"
          type="text"
          icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}
          style={{ color: isActive ? '#52c41a' : '#ff4d4f' }}
          onClick={() => handleToggleActive(record)}
        >
          {isActive ? '启用' : '停用'}
        </Button>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 160,
      render: (date: string) => (date ? new Date(date).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: AdminRecord) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admins/${record.id}`)}
          >
            查看
          </Button>
          <Button size="small" type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            size="small"
            type="link"
            icon={<KeyOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Popconfirm
            title="确认删除？"
            description="删除后将无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px' }}>
      <List>
        <Card>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>管理员管理</h1>
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                新建管理员
              </Button>
            </Col>
          </Row>

          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              placeholder="搜索用户名、邮箱或姓名"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              placeholder="筛选状态"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value={true}>启用</Select.Option>
              <Select.Option value={false}>停用</Select.Option>
            </Select>
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space style={{ marginBottom: 16 }}>
              <span>已选择 {selectedRowKeys.length} 项</span>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>
                取消选择
              </Button>
              <Popconfirm
                title="确认批量删除？"
                description={`将删除 ${selectedRowKeys.length} 个管理员`}
                onConfirm={handleBatchDelete}
              >
                <Button size="small" danger>
                  批量删除
                </Button>
              </Popconfirm>
            </Space>
          )}

          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys as string[]),
            }}
            columns={columns}
            rowKey="id"
            dataSource={(result as any)?.data || []}
            loading={query.isLoading}
            scroll={{ x: 1400 }}
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

          <Modal
            title={editingRecord ? '编辑管理员' : '新建管理员'}
            open={isModalVisible}
            onOk={handleSubmit}
            onCancel={() => setIsModalVisible(false)}
            okText="确定"
            cancelText="取消"
            width={600}
          >
            <AdminForm
              form={form}
              isEdit={!!editingRecord}
              roles={allRoles}
              currentRoles={editingRecord?.roles.map((r) => r.id) || []}
            />
          </Modal>

          <Modal
            title={`重置密码 - ${passwordRecord?.username || ''}`}
            open={isPasswordModalVisible}
            onOk={handlePasswordSubmit}
            onCancel={() => setIsPasswordModalVisible(false)}
            okText="确认重置"
            cancelText="取消"
          >
            <Form form={passwordForm} layout="vertical">
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 8, message: '密码至少 8 个字符' },
                ]}
              >
                <Input.Password placeholder="请输入新密码（至少 8 个字符）" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="请再次输入新密码" />
              </Form.Item>
            </Form>
          </Modal>
        </Card>
      </List>
    </div>
  );
};
