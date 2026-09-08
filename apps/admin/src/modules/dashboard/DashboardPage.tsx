import { Card, Row, Col, Statistic, Table, Typography, Space, Button, Spin } from 'antd';
import {
  ShoppingCartOutlined,
  DollarOutlined,
  PayCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTrpcClient } from '../../shared/trpc/trpcClient';
import { OrderStatusTag } from '../product/components/OrderStatusTag';

const { Title, Text } = Typography;

const QUICK_LINKS = [
  { label: '商品管理', path: '/products', desc: '上架 / 编辑销售商品' },
  { label: '订单管理', path: '/orders', desc: '查看订单、发货与退款' },
  { label: '客服会话', path: '/kf/sessions', desc: 'AI 接待与人工接管' },
  { label: '落地页统计', path: '/landing-stats', desc: '流量与转化分析' },
];

function DashboardPage() {
  const navigate = useNavigate();
  // AppRouter 类型在 monorepo 中暂为 unknown（已知问题），这里通过 any 转发到 tRPC proxy
  const trpc = getTrpcClient() as any;

  const today = new Date();
  const dateStr = today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const stats = useQuery({
    queryKey: ['order', 'getStats'],
    queryFn: () => trpc.order.getStats.query(),
    refetchInterval: 60_000,
  });

  const recentOrders = useQuery({
    queryKey: ['order', 'getMany', 'recent'],
    queryFn: () => trpc.order.getMany.query({ page: 1, pageSize: 5 }),
    refetchInterval: 60_000,
  });

  const isLoading = stats.isLoading || recentOrders.isLoading;

  const orderColumns = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', ellipsis: true },
    {
      title: '客户',
      key: 'customer',
      render: (_: unknown, record: any) => record.contact?.nickname || '-',
    },
    {
      title: '金额',
      dataIndex: 'totalAmountFen',
      key: 'totalAmountFen',
      render: (val: number) => `¥${(val / 100).toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <OrderStatusTag status={status} />,
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          <span>{new Date(val).toLocaleString('zh-CN')}</span>
        </Space>
      ),
    },
  ];

  const reload = () => {
    stats.refetch();
    recentOrders.refetch();
  };

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
  }

  const s = stats.data ?? { totalOrders: 0, paidOrders: 0, pendingOrders: 0, totalRevenueFen: 0 };

  return (
    <div>
      {/* Welcome Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            欢迎回来
          </Title>
          <Text type="secondary">{dateStr}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={reload}>
          刷新
        </Button>
      </div>

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="累计订单"
              value={s.totalOrders}
              prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="已支付订单"
              value={s.paidOrders}
              prefix={<PayCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="待支付订单"
              value={s.pendingOrders}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="累计营收"
              value={(s.totalRevenueFen / 100).toFixed(2)}
              prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
              suffix="元"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Orders + Quick Links */}
      <Row gutter={16}>
        <Col span={14}>
          <Card title="最近订单" bordered={false} size="small">
            <Table
              dataSource={recentOrders.data?.items ?? []}
              columns={orderColumns}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => navigate(`/orders/${record.id}`),
                style: { cursor: 'pointer' },
              })}
              locale={{ emptyText: '暂无订单' }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="快捷入口" bordered={false} size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {QUICK_LINKS.map((link) => (
                <Card
                  key={link.path}
                  size="small"
                  hoverable
                  style={{ marginBottom: 0 }}
                  onClick={() => navigate(link.path)}
                >
                  <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: 14 }}>
                      {link.label}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {link.desc}
                    </Text>
                  </Space>
                </Card>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default DashboardPage;
