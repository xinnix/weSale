import { Card, Col, Row, Spin, Empty, Segmented, Typography, Table } from 'antd';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getTrpcClient } from '../../../shared/trpc/trpcClient';
import { useQuery } from '@tanstack/react-query';

const { Title, Text } = Typography;

type RangeDay = 7 | 14 | 30;

export function LandingStatsPage() {
  const [days, setDays] = useState<RangeDay>(7);
  // AppRouter 类型在 monorepo 中暂为 unknown（已知问题），这里通过 any 转发到 tRPC proxy
  const trpc = getTrpcClient() as any;

  const overview = useQuery({
    queryKey: ['landingStats', 'overview', days],
    queryFn: () => trpc.landingStats.overview.query({ days }),
    refetchInterval: 60_000,
  });

  const timeSeries = useQuery({
    queryKey: ['landingStats', 'timeSeries', days],
    queryFn: () => trpc.landingStats.timeSeries.query({ days }),
    refetchInterval: 60_000,
  });

  const topPaths = useQuery({
    queryKey: ['landingStats', 'topPaths', days],
    queryFn: () => trpc.landingStats.topPaths.query({ days }),
    refetchInterval: 60_000,
  });

  const topSources = useQuery({
    queryKey: ['landingStats', 'topSources', days],
    queryFn: () => trpc.landingStats.topSources.query({ days }),
    refetchInterval: 60_000,
  });

  const isLoading =
    overview.isLoading || timeSeries.isLoading || topPaths.isLoading || topSources.isLoading;

  const chartData = useMemo(
    () => (timeSeries.data || []).map((d: any) => ({ date: d.date.slice(5), PV: d.pv, UV: d.uv })),
    [timeSeries.data],
  );

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          落地页访问统计
        </Title>
        <Segmented
          options={[
            { label: '7 天', value: 7 },
            { label: '14 天', value: 14 },
            { label: '30 天', value: 30 },
          ]}
          value={days}
          onChange={(v) => setDays(v as RangeDay)}
        />
      </div>

      <Spin spinning={isLoading}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Text type="secondary">页面浏览 (PV)</Text>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>
                {overview.data?.pv ?? '-'}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Text type="secondary">独立访客 (UV)</Text>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>
                {overview.data?.uv ?? '-'}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Text type="secondary">进入次数</Text>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>
                {overview.data?.entryCount ?? '-'}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                无 referrer 的访问
              </Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Text type="secondary">人均浏览</Text>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>
                {overview.data && overview.data.uv > 0
                  ? (overview.data.pv / overview.data.uv).toFixed(2)
                  : '-'}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                PV / UV
              </Text>
            </Card>
          </Col>
        </Row>

        <Card title="访问趋势" style={{ marginTop: 16 }}>
          {chartData.length === 0 ? (
            <Empty description="暂无数据" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1677ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="uvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="PV"
                  stroke="#1677ff"
                  fill="url(#pvGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="UV"
                  stroke="#52c41a"
                  fill="url(#uvGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="访问页面 Top 5">
              <Table
                size="small"
                dataSource={topPaths.data || []}
                rowKey="path"
                pagination={false}
                columns={[
                  { title: '路径', dataIndex: 'path' },
                  { title: '访问次数', dataIndex: 'count', width: 100, align: 'right' },
                ]}
                locale={{ emptyText: <Empty description="暂无数据" /> }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="访问来源 Top 5">
              <Table
                size="small"
                dataSource={topSources.data || []}
                rowKey="source"
                pagination={false}
                columns={[
                  { title: '来源', dataIndex: 'source' },
                  { title: 'PV', dataIndex: 'pv', width: 80, align: 'right' },
                  { title: 'UV', dataIndex: 'uv', width: 80, align: 'right' },
                ]}
                locale={{ emptyText: <Empty description="暂无数据" /> }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
