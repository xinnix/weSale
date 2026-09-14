interface Msg {
  role: string;
  content: string;
  createdAt: string;
}

/** 最近 KF 会话摘要（自有 DB 全量入库记录） */
export default function RecentSession({ messages }: { messages: Msg[] }) {
  if (!messages.length) {
    return (
      <section className="section">
        <h3>最近会话</h3>
        <div className="empty">无会话记录</div>
      </section>
    );
  }
  return (
    <section className="section">
      <h3>最近会话</h3>
      <ul className="messages">
        {messages.map((m, i) => (
          <li key={i} className={`message ${m.role === 'assistant' ? 'assistant' : 'customer'}`}>
            <span className="role">{m.role === 'assistant' ? '客服' : '顾客'}</span>
            <span className="content">{m.content}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
