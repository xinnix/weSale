import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Input,
  Button,
  Avatar,
  Space,
  Typography,
  App,
  Select,
  Modal,
  Descriptions,
  Divider,
  Popconfirm,
} from 'antd';
import {
  SendOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  CustomerServiceOutlined,
  FileTextOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { SessionStateTag, IntentLevelTag } from '../components/SessionStateTag';
import { getTrpcClient } from '../../../shared/trpc/trpcClient';

const { Text } = Typography;

interface Message {
  id: string;
  role: string;
  type: string;
  origin: string;
  content: string;
  sendTime: string;
  servicerUserId?: string;
  internalNote?: string;
}

interface Session {
  id: string;
  sessionKey: string;
  openKfId: string;
  state: string;
  intentLevel: string;
  turnCount: number;
  lastActiveAt: string;
  createdAt: string;
  contact?: {
    id: string;
    nickname?: string;
    openId: string;
    phone?: string;
    status: string;
    avatarUrl?: string;
  };
  messages?: Message[];
}

const INTENT_OPTIONS = [
  { value: 'UNKNOWN', label: '未知' },
  { value: 'LOW', label: '低' },
  { value: 'MEDIUM', label: '中' },
  { value: 'HIGH', label: '高' },
  { value: 'CLOSING', label: '临门' },
];

export const SessionChatPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: '', url: '', desc: '' });

  const trpc = getTrpcClient() as any;

  const fetchSession = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await trpc.wechatKf.session.getOne.query({ id });
      setSession(data);
    } catch (e: any) {
      message.error('加载会话失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const handleSendText = async () => {
    if (!inputText.trim() || !id || sending) return;
    setSending(true);
    try {
      await trpc.wechatKf.message.sendText.mutate({
        sessionId: id,
        content: inputText.trim(),
      });
      setInputText('');
      fetchSession();
    } catch (e: any) {
      message.error('发送失败: ' + (e.message || ''));
    } finally {
      setSending(false);
    }
  };

  const handleSendLink = async () => {
    if (!linkForm.title || !linkForm.url || !id) return;
    setSending(true);
    try {
      await trpc.wechatKf.message.sendLink.mutate({
        sessionId: id,
        title: linkForm.title,
        url: linkForm.url,
        desc: linkForm.desc,
      });
      setLinkModalOpen(false);
      setLinkForm({ title: '', url: '', desc: '' });
      fetchSession();
    } catch (e: any) {
      message.error('发送失败: ' + (e.message || ''));
    } finally {
      setSending(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !id) return;
    setSending(true);
    try {
      await trpc.wechatKf.message.addNote.mutate({
        sessionId: id,
        content: noteText.trim(),
      });
      setNoteModalOpen(false);
      setNoteText('');
      fetchSession();
    } catch (e: any) {
      message.error('添加备注失败');
    } finally {
      setSending(false);
    }
  };

  const handleTakeOver = async () => {
    if (!id) return;
    try {
      await trpc.wechatKf.session.takeOver.mutate({ id });
      message.success('已接手会话');
      fetchSession();
    } catch (e: any) {
      message.error('接手失败');
    }
  };

  const handleCloseSession = async () => {
    if (!id) return;
    try {
      await trpc.wechatKf.session.closeSession.mutate({ id });
      message.success('已关闭会话');
      fetchSession();
    } catch (e: any) {
      message.error('关闭失败');
    }
  };

  const handleUpdateIntent = async (intentLevel: string) => {
    if (!id) return;
    try {
      await trpc.wechatKf.session.update.mutate({
        id,
        data: { intentLevel },
      });
      fetchSession();
    } catch (e: any) {
      message.error('更新失败');
    }
  };

  const renderMessage = (msg: Message) => {
    const isCustomer = msg.origin === 'CUSTOMER';
    const isNote = msg.type === 'SYSTEM_NOTE';
    const isEvent = msg.type === 'EVENT';

    if (isEvent) {
      return (
        <div
          key={msg.id}
          style={{ textAlign: 'center', margin: '8px 0', color: '#999', fontSize: 12 }}
        >
          {msg.content}
        </div>
      );
    }

    if (isNote) {
      return (
        <div
          key={msg.id}
          style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}
        >
          <Space align="start" style={{ maxWidth: '70%' }}>
            <Avatar size="small" icon={<FileTextOutlined />} style={{ background: '#faad14' }} />
            <div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>内部备注</div>
              <div
                style={{
                  background: '#fff7e6',
                  border: '1px solid #ffe58f',
                  borderRadius: 8,
                  padding: '8px 12px',
                  whiteSpace: 'pre-wrap',
                  color: '#ad6800',
                }}
              >
                {msg.content}
              </div>
            </div>
          </Space>
        </div>
      );
    }

    // Regular message
    let contentEl: React.ReactNode = msg.content;

    if (msg.type === 'LINK_CARD') {
      try {
        const link = JSON.parse(msg.content);
        contentEl = (
          <div
            style={{ background: '#f5f5f5', borderRadius: 6, padding: 8, cursor: 'pointer' }}
            onClick={() => window.open(link.url, '_blank')}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{link.title}</div>
            {link.desc && <div style={{ fontSize: 12, color: '#666' }}>{link.desc}</div>}
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{link.url}</div>
          </div>
        );
      } catch {
        /* fallback to raw content */
      }
    }

    if (msg.type === 'IMAGE') {
      try {
        const img = JSON.parse(msg.content);
        contentEl = (
          <img
            src={img.url || img.content || msg.content}
            alt=""
            style={{ maxWidth: 200, borderRadius: 4 }}
          />
        );
      } catch {
        contentEl = <img src={msg.content} alt="" style={{ maxWidth: 200, borderRadius: 4 }} />;
      }
    }

    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: isCustomer ? 'flex-end' : 'flex-start',
          marginBottom: 12,
        }}
      >
        <Space align="start" style={{ maxWidth: '70%' }}>
          {!isCustomer && (
            <Avatar
              size="small"
              icon={<CustomerServiceOutlined />}
              style={{ background: '#1677ff' }}
            />
          )}
          <div>
            <div
              style={{
                background: isCustomer ? '#1677ff' : '#f0f0f0',
                color: isCustomer ? '#fff' : '#000',
                borderRadius: 8,
                padding: '8px 12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {contentEl}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#999',
                marginTop: 2,
                textAlign: isCustomer ? 'right' : 'left',
              }}
            >
              {msg.sendTime ? new Date(msg.sendTime).toLocaleString('zh-CN') : ''}
            </div>
          </div>
          {isCustomer && <Avatar size="small" icon={<UserOutlined />} />}
        </Space>
      </div>
    );
  };

  const canTakeOver =
    session &&
    ['GREETING', 'NEEDS_DISCOVERY', 'PRODUCT_MATCH', 'OBJECTION_HANDLING', 'CLOSING'].includes(
      session.state,
    );

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', gap: 12, overflow: 'hidden' }}>
      {/* 左栏 - 会话信息 */}
      <Card
        style={{ width: 240, flexShrink: 0, minHeight: 0, overflow: 'auto' }}
        styles={{ body: { padding: 16, overflow: 'auto' } }}
        loading={loading}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/kf/sessions')}
          style={{ marginBottom: 12, padding: 0 }}
        >
          返回列表
        </Button>
        <Divider style={{ margin: '8px 0' }} />

        {session && (
          <Descriptions column={1} size="small" labelStyle={{ fontSize: 12, color: '#999' }}>
            <Descriptions.Item label="访客">
              {session.contact?.nickname || session.contact?.openId?.slice(-8) || '-'}
            </Descriptions.Item>
            {session.contact?.phone && (
              <Descriptions.Item label="手机">{session.contact.phone}</Descriptions.Item>
            )}
            <Descriptions.Item label="客服账号">
              <Text copyable style={{ fontSize: 11 }}>
                {session.openKfId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <SessionStateTag state={session.state} />
            </Descriptions.Item>
            <Descriptions.Item label="意向度">
              <IntentLevelTag level={session.intentLevel} />
            </Descriptions.Item>
            <Descriptions.Item label="轮次">{session.turnCount}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(session.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {/* 中栏 - 聊天区域 */}
      <Card
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
        styles={{
          body: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
        loading={loading}
      >
        {/* 消息列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {session?.messages?.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 100 }}>暂无消息</div>
          )}
          {session?.messages?.map(renderMessage)}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}
        >
          <Input.TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            disabled={sending}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendText}
            disabled={!inputText.trim() || sending}
          />
          <Button icon={<LinkOutlined />} onClick={() => setLinkModalOpen(true)} />
          <Button icon={<FileTextOutlined />} onClick={() => setNoteModalOpen(true)} />
        </div>
      </Card>

      {/* 右栏 - 快捷操作 */}
      <Card
        style={{ width: 200, flexShrink: 0, minHeight: 0, overflow: 'auto' }}
        styles={{ body: { padding: 16 } }}
        loading={loading}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>会话状态</div>
          {session && <SessionStateTag state={session.state} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {canTakeOver && (
            <Button type="primary" danger block onClick={handleTakeOver}>
              接手会话
            </Button>
          )}
          {session?.state !== 'TIMED_OUT' && session?.state !== 'CONVERTED' && (
            <Popconfirm title="确认关闭此会话？" onConfirm={handleCloseSession}>
              <Button block>关闭会话</Button>
            </Popconfirm>
          )}
          <Button block icon={<FileTextOutlined />} onClick={() => setNoteModalOpen(true)}>
            添加备注
          </Button>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>意向度</div>
          <Select
            value={session?.intentLevel}
            onChange={handleUpdateIntent}
            options={INTENT_OPTIONS}
            style={{ width: '100%' }}
            size="small"
          />
        </div>
      </Card>

      {/* 链接消息 Modal */}
      <Modal
        title="发送链接"
        open={linkModalOpen}
        onCancel={() => setLinkModalOpen(false)}
        onOk={handleSendLink}
        okButtonProps={{ disabled: !linkForm.title || !linkForm.url || sending }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            placeholder="标题"
            value={linkForm.title}
            onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
          />
          <Input
            placeholder="链接 URL"
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
          />
          <Input.TextArea
            placeholder="描述（可选）"
            value={linkForm.desc}
            onChange={(e) => setLinkForm({ ...linkForm, desc: e.target.value })}
            rows={2}
          />
        </div>
      </Modal>

      {/* 内部备注 Modal */}
      <Modal
        title="添加内部备注"
        open={noteModalOpen}
        onCancel={() => {
          setNoteModalOpen(false);
          setNoteText('');
        }}
        onOk={handleAddNote}
        okButtonProps={{ disabled: !noteText.trim() || sending }}
      >
        <Input.TextArea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="输入内部备注（客户不可见）"
          rows={4}
        />
      </Modal>
    </div>
  );
};
