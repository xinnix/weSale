import type { OrderBrief } from '../api/profile';

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  COMPLETED: '已完成',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
};

function fmt(t: string | null): string {
  if (!t) return '—';
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 历史订单（小程序侧 + KF 侧合并，OneID 打通后完整） */
export default function OrderHistory({ orders }: { orders: OrderBrief[] }) {
  if (!orders.length) {
    return (
      <section className="section">
        <h3>历史订单</h3>
        <div className="empty">暂无订单</div>
      </section>
    );
  }
  return (
    <section className="section">
      <h3>历史订单（{orders.length}）</h3>
      <ul className="orders">
        {orders.map((o) => (
          <li key={o.id} className="order">
            <div className="order-main">
              <span className="order-name">{o.productName ?? '—'}</span>
              <span className="order-status">{STATUS_LABEL[o.status] ?? o.status}</span>
            </div>
            <div className="order-sub">
              ¥{(o.totalAmountFen / 100).toFixed(2)} · {fmt(o.paidAt)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
