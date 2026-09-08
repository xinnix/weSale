import { Space, Button, message, Modal, Input, Typography } from 'antd';
import { useState } from 'react';
import type { ColumnType } from 'antd/es/table';
import { StandardListPage } from '../../../shared/components/StandardListPage';
import { OrderStatusTag } from '../components/OrderStatusTag';
import { useUpdate } from '@refinedev/core';
import { useNavigate } from 'react-router-dom';

interface OrderRecord {
  id: string;
  orderNo: string;
  contactId: string;
  productId: string;
  quantity: number;
  totalAmountFen: number;
  status: string;
  createdAt: string;
  product?: { id: string; name: string; coverImage?: string };
  contact?: { id: string; nickname?: string; avatarUrl?: string };
  [key: string]: unknown;
}

const columns: ColumnType<OrderRecord>[] = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 180 },
  {
    title: '客户',
    key: 'contact',
    width: 120,
    render: (_: unknown, record: OrderRecord) => record.contact?.nickname || '-',
  },
  {
    title: '产品',
    key: 'product',
    width: 160,
    render: (_: unknown, record: OrderRecord) => record.product?.name || '-',
  },
  {
    title: '金额',
    dataIndex: 'totalAmountFen',
    key: 'totalAmountFen',
    width: 100,
    render: (val: number) => `¥${(val / 100).toFixed(2)}`,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (val: string) => <OrderStatusTag status={val} />,
  },
  {
    title: '下单时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
];

export function OrderListPage() {
  const [refundModal, setRefundModal] = useState<{
    visible: boolean;
    orderId: string;
    orderNo: string;
  }>({
    visible: false,
    orderId: '',
    orderNo: '',
  });
  const [refundReason, setRefundReason] = useState('');
  const { mutate: refundOrder } = useUpdate();
  const navigate = useNavigate();

  const handleRefund = () => {
    if (!refundReason.trim()) {
      message.warning('请输入退款原因');
      return;
    }
    refundOrder(
      {
        resource: 'order',
        id: refundModal.orderId,
        meta: { action: 'refundOrder' },
        values: { refundReason },
      },
      {
        onSuccess: () => {
          message.success('退款申请已提交');
          setRefundModal({ visible: false, orderId: '', orderNo: '' });
          setRefundReason('');
        },
      },
    );
  };

  return (
    <>
      <StandardListPage<OrderRecord>
        resource="order"
        title="订单管理"
        columns={columns}
        hideCreateButton
        filterFields={[
          {
            field: 'status',
            type: 'select',
            placeholder: '订单状态',
            options: [
              { value: 'PENDING', label: '待支付' },
              { value: 'PAID', label: '已支付' },
              { value: 'COMPLETED', label: '已完成' },
              { value: 'REFUNDING', label: '退款中' },
              { value: 'REFUNDED', label: '已退款' },
              { value: 'CANCELLED', label: '已取消' },
            ],
          },
        ]}
        permissions={{
          delete: 'order:refund',
        }}
        renderRowActions={(record) => (
          <Space size="small">
            <Button size="small" type="link" onClick={() => navigate(`/orders/${record.id}`)}>
              详情
            </Button>
            {record.status === 'PAID' && (
              <Button
                size="small"
                type="link"
                danger
                onClick={() =>
                  setRefundModal({ visible: true, orderId: record.id, orderNo: record.orderNo })
                }
              >
                退款
              </Button>
            )}
          </Space>
        )}
      />

      <Modal
        title={`退款 - ${refundModal.orderNo}`}
        open={refundModal.visible}
        onOk={handleRefund}
        onCancel={() => {
          setRefundModal({ visible: false, orderId: '', orderNo: '' });
          setRefundReason('');
        }}
        okText="确认退款"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text>请输入退款原因：</Typography.Text>
          <Input.TextArea
            rows={3}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="请说明退款原因"
          />
        </div>
      </Modal>
    </>
  );
}
