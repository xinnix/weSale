import { useState } from 'react';
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core';
import { List } from '@refinedev/antd';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Tag,
  Card,
  Row,
  Col,
  App,
  Popconfirm,
  Typography,
} from 'antd';
import { SearchOutlined, PlusOutlined, CopyOutlined } from '@ant-design/icons';
import { WecomConfigForm } from '../components/WecomConfigForm';

const { Text } = Typography;

interface WecomConfig {
  id: string;
  name: string;
  corpId: string;
  agentId: number;
  secret: string;
  token: string;
  encodingAESKey: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

export const WecomConfigListPage = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WecomConfig | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const { mutate: create } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: deleteOne } = useDelete();

  const { tableQuery, currentPage, setCurrentPage, pageSize, setPageSize } = useTable<WecomConfig>({
    resource: 'wecom.config',
    pagination: { currentPage: 1, pageSize: 20, mode: 'server' },
    filters: {
      initial: searchText
        ? [{ field: 'search', operator: 'contains', value: searchText } as any]
        : [],
    },
  });

  const result = tableQuery.data;
  const baseUrl = window.location.origin;

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setIsModalVisible(true);
  };

  const handleEdit = (record: WecomConfig) => {
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      corpId: record.corpId,
      agentId: record.agentId,
      secret: '',
      token: record.token,
      encodingAESKey: record.encodingAESKey,
      description: record.description,
      isActive: record.isActive,
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingRecord) {
        const updateData: any = { ...values };
        if (!updateData.secret) delete updateData.secret;

        update(
          { resource: 'wecom.config', id: editingRecord.id, values: updateData },
          {
            onSuccess: () => {
              message.success('更新成功');
              setIsModalVisible(false);
              tableQuery.refetch();
            },
            onError: (error: any) => message.error('更新失败: ' + (error.message || '未知错误')),
          },
        );
      } else {
        create(
          { resource: 'wecom.config', values },
          {
            onSuccess: () => {
              message.success('创建成功');
              setIsModalVisible(false);
              tableQuery.refetch();
            },
            onError: (error: any) => message.error('创建失败: ' + (error.message || '未知错误')),
          },
        );
      }
    } catch (error) {
      console.error('Form validation error:', error);
    }
  };

  const handleDelete = (id: string) => {
    deleteOne(
      { resource: 'wecom.config', id },
      {
        onSuccess: () => {
          message.success('删除成功');
          tableQuery.refetch();
        },
        onError: (error: any) => message.error('删除失败: ' + (error.message || '未知错误')),
      },
    );
  };

  const copyCallbackUrl = (id: string) => {
    const url = `${baseUrl}/api/wecom/callback/${id}`;
    navigator.clipboard.writeText(url);
    message.success('回调 URL 已复制');
  };

  const columns = [
    {
      title: '应用名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: 'Corp ID',
      dataIndex: 'corpId',
      width: 160,
      render: (corpId: string) => <Text copyable={{ text: corpId }}>{corpId}</Text>,
    },
    {
      title: 'AgentId',
      dataIndex: 'agentId',
      width: 100,
    },
    {
      title: 'Secret',
      dataIndex: 'secret',
      width: 120,
      render: (secret: string) => <Tag color="orange">{secret}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '回调 URL',
      width: 200,
      render: (_: any, record: WecomConfig) => (
        <Space size="small">
          <Text style={{ maxWidth: 150, fontSize: 12 }} ellipsis>
            {baseUrl}/api/wecom/callback/{record.id}
          </Text>
          <Button
            size="small"
            type="link"
            icon={<CopyOutlined />}
            onClick={() => copyCallbackUrl(record.id)}
          />
        </Space>
      ),
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: WecomConfig) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除此配置？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" type="link" danger>
              删除
            </Button>
          </Popconfirm>
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
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>企业微信应用配置</h1>
              <div style={{ fontSize: 14, color: '#999', marginTop: 8 }}>
                管理企业微信应用配置，配置回调 URL 后即可接收消息和事件
              </div>
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                新建配置
              </Button>
            </Col>
          </Row>

          <Input
            placeholder="搜索应用名称或 Corp ID"
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

          <Modal
            title={editingRecord ? '编辑配置' : '新建配置'}
            open={isModalVisible}
            onOk={handleSubmit}
            onCancel={() => setIsModalVisible(false)}
            okText="确定"
            cancelText="取消"
            width={600}
          >
            <WecomConfigForm form={form} isEdit={!!editingRecord} />
          </Modal>
        </Card>
      </List>
    </div>
  );
};
