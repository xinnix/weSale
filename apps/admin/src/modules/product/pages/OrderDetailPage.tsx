import { useParams, useNavigate } from 'react-router-dom';
import { useOne } from '@refinedev/core';
import { Card, Descriptions, Button, Spin, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { OrderStatusTag } from '../components/OrderStatusTag';

const billingCycleLabels: Record<string, string> = {
  ONE_TIME: '一次性',
  MONTHLY: '月付',
  YEARLY: '年付',
  LIFETIME: '终身',
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { query } = useOne({ resource: 'order', id });
  const { data: responseData, isLoading } = query;
  const order = (responseData?.data as any) ?? null;

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!order) return <Typography.Text>订单不存在</Typography.Text>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/orders')}
        style={{ marginBottom: 16 }}
      >
        返回订单列表
      </Button>

      <Card title={`订单 ${order.orderNo}`} style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="订单号">{order.orderNo}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <OrderStatusTag status={order.status} />
          </Descriptions.Item>
          <Descriptions.Item label="金额">
            ¥{(order.totalAmountFen / 100).toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="数量">{order.quantity}</Descriptions.Item>
          <Descriptions.Item label="客户">{order.contact?.nickname || '-'}</Descriptions.Item>
          <Descriptions.Item label="产品">{order.product?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="下单时间">
            {new Date(order.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="支付时间">
            {order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {(order.status === 'REFUNDING' || order.status === 'REFUNDED') && (
        <Card title="退款信息" style={{ marginBottom: 16 }}>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="退款金额">
              {order.refundAmountFen ? `¥${(order.refundAmountFen / 100).toFixed(2)}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="退款原因">{order.refundReason || '-'}</Descriptions.Item>
            <Descriptions.Item label="退款时间">
              {order.refundedAt ? new Date(order.refundedAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="支付流水号">
              {order.paidTransactionId || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {order.product && (
        <Card title="产品信息">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="产品名称">{order.product.name}</Descriptions.Item>
            <Descriptions.Item label="标识">{order.product.slug}</Descriptions.Item>
            <Descriptions.Item label="单价">
              ¥{(order.unitPriceFen / 100).toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="计费周期">
              {billingCycleLabels[order.product.billingCycle] || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
