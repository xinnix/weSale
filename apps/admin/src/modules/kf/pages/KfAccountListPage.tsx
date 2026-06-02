import { useState, useEffect } from 'react';
import { Card, Table, Avatar, App } from 'antd';

interface KfAccount {
  kf_id: string;
  name: string;
  avatar?: string;
}

export const KfAccountListPage = () => {
  const { message } = App.useApp();
  const [accounts, setAccounts] = useState<KfAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const result = await (window as any).__trpcClient?.wechatKf?.account?.getKfAccounts?.query(
          {},
        );
        setAccounts(result?.kf_list || []);
      } catch (e: any) {
        message.error('加载客服账号失败');
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const columns = [
    {
      title: '头像',
      dataIndex: 'avatar',
      width: 60,
      render: (avatar: string) => <Avatar src={avatar} size="small" />,
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: 'KF ID',
      dataIndex: 'kf_id',
      width: 200,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <Card>
        <h1 style={{ margin: '0 0 16px 0', fontSize: 24, fontWeight: 'bold' }}>客服账号</h1>
        <Table
          columns={columns}
          rowKey="kf_id"
          dataSource={accounts}
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};
