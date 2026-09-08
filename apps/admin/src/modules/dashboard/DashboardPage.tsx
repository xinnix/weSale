import { Card, Row, Col, Statistic, Table, List, Tag, Typography, Space } from 'antd';
import {
  ShoppingCartOutlined,
  DollarOutlined,
  TeamOutlined,
  MessageOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// --- Mock Data ---

const recentOrders = [
  { id: 'ORD-20260603001', customer: '张三', amount: 2680, status: '已完成', time: '10:32' },
  { id: 'ORD-20260603002', customer: '李四', amount: 1590, status: '处理中', time: '11:15' },
  { id: 'ORD-20260603003', customer: '王五', amount: 3200, status: '待支付', time: '13:47' },
  { id: 'ORD-20260603004', customer: '赵六', amount: 890, status: '已完成', time: '14:22' },
  { id: 'ORD-20260603005', customer: '钱七', amount: 4100, status: '已取消', time: '15:08' },
];

const todoItems = [
  { title: '审核新客户注册申请', priority: 'high' },
  { title: '处理退款订单 ORD-20260602017', priority: 'high' },
  { title: '更新产品价格表', priority: 'medium' },
  { title: '回复客户咨询消息', priority: 'medium' },
  { title: '导出本月销售报表', priority: 'low' },
];

const statusColorMap: Record<string, string> = {
  已完成: 'green',
  处理中: 'blue',
  待支付: 'orange',
  已取消: 'red',
};

const priorityColorMap: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const priorityLabelMap: Record<string, string> = {
  high: '紧急',
  medium: '一般',
  low: '低',
};

// --- Component ---

function DashboardPage() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const orderColumns = [
    { title: '订单号', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '客户', dataIndex: 'customer', key: 'customer' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => `¥${val.toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusColorMap[status]}>{status}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      render: (val: string) => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          <span>{val}</span>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Welcome Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          欢迎回来
        </Title>
        <Text type="secondary">{dateStr}</Text>
      </div>

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="今日订单"
              value={12}
              prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="本月营收"
              value={28500}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              suffix="元"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="活跃客户"
              value={156}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="待处理消息"
              value={8}
              prefix={<MessageOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Orders + Todo List */}
      <Row gutter={16}>
        <Col span={14}>
          <Card title="最近订单" bordered={false} size="small">
            <Table
              dataSource={recentOrders}
              columns={orderColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="待办事项" bordered={false} size="small">
            <List
              dataSource={todoItems}
              renderItem={(item) => (
                <List.Item style={{ padding: '10px 0' }}>
                  <List.Item.Meta title={<Text style={{ fontSize: 14 }}>{item.title}</Text>} />
                  <Tag color={priorityColorMap[item.priority]}>
                    {priorityLabelMap[item.priority]}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default DashboardPage;
