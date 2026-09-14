import { Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlaceholderPage } from '../../../shared/components/PlaceholderPage';

interface StrategyRow {
  strategy: string;
  scene: string;
  template: string;
  adoptRate: string;
}

const columns: ColumnsType<StrategyRow> = [
  {
    title: '策略',
    dataIndex: 'strategy',
    key: 'strategy',
    width: 140,
    render: (v: string) => <Tag color="blue">{v}</Tag>,
  },
  { title: '适用场景', dataIndex: 'scene', key: 'scene', width: 180 },
  {
    title: '话术模板',
    dataIndex: 'template',
    key: 'template',
    render: (v: string) => <Typography.Text type="secondary">{v}</Typography.Text>,
  },
  { title: '采纳率', dataIndex: 'adoptRate', key: 'adoptRate', width: 100 },
];

const dataSource: StrategyRow[] = [
  {
    strategy: 'A 理性科普',
    scene: '产品成分 / 功效咨询',
    template: '这款产品的核心成分是…，适合…人群',
    adoptRate: '42%',
  },
  {
    strategy: 'B 感性逼单',
    scene: '价格犹豫 / 临门一脚',
    template: '现在下单正好赶上限时活动，我帮您留一份～',
    adoptRate: '31%',
  },
  {
    strategy: 'C 搭售升级',
    scene: '已购单一品类',
    template: '搭配…使用效果更好，很多老客都这样搭',
    adoptRate: '27%',
  },
];

/** 推荐话术：侧边栏 AI Copilot 三策略（M2 规划） */
export function CopilotPage() {
  return (
    <PlaceholderPage<StrategyRow>
      title="推荐话术"
      description="侧边栏 AI Copilot 三策略话术——基于客户画像与 KF 会话上下文流式生成（理性科普 / 感性逼单 / 搭售升级），销售在企业微信客户端内逐条确认后发送（P1 风控红线）。"
      hint="侧边栏壳与客户画像已就绪；意图识别、三策略流式生成（TTFT ≤1.5s）、采纳率上报为 Phase 2 M2 规划。"
      columns={columns}
      dataSource={dataSource}
    />
  );
}
