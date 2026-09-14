import { Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlaceholderPage } from '../../../shared/components/PlaceholderPage';

interface KnowledgeRow {
  nodeType: string;
  nodeTypeLabel: string;
  title: string;
  summary: string;
  updatedAt: string;
}

const columns: ColumnsType<KnowledgeRow> = [
  {
    title: '类型',
    dataIndex: 'nodeTypeLabel',
    key: 'nodeTypeLabel',
    width: 120,
    render: (label: string, record) => (
      <Tag
        color={
          record.nodeType === 'ENTITY' ? 'blue' : record.nodeType === 'POLICY' ? 'orange' : 'purple'
        }
      >
        {label}
      </Tag>
    ),
  },
  { title: '标题', dataIndex: 'title', key: 'title', width: 220 },
  {
    title: '摘要',
    dataIndex: 'summary',
    key: 'summary',
    render: (v: string) => <Typography.Text type="secondary">{v}</Typography.Text>,
  },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 140 },
];

const dataSource: KnowledgeRow[] = [
  {
    nodeType: 'ENTITY',
    nodeTypeLabel: '实体',
    title: '冷萃咖啡液 · 成分与适用',
    summary: '适用于乳糖不耐人群，含咖啡因…',
    updatedAt: '2026-09-10',
  },
  {
    nodeType: 'POLICY',
    nodeTypeLabel: '政策',
    title: '七天无理由退换规则',
    summary: '生鲜类不支持无理由退换…',
    updatedAt: '2026-09-08',
  },
  {
    nodeType: 'RECO',
    nodeTypeLabel: '推荐',
    title: '咖啡豆 → 手冲壶',
    summary: '主品为豆类时推荐手冲壶搭配…',
    updatedAt: '2026-09-09',
  },
];

/** 知识库：KnowledgeNode（M3 规划） */
export function KnowledgeBasePage() {
  return (
    <PlaceholderPage<KnowledgeRow>
      title="知识库"
      description="知识库（KnowledgeNode）——商品卖点 / 异议处理 / 交叉推荐矩阵，作为 Copilot 与 KF 接待共享的知识层，经 pgvector 检索注入生成提示词。"
      hint="模型与检索为 Phase 2 M3 规划（pgvector 向量 + 关键词双轨）；admin 知识条目 CRUD 与 JSON/Markdown 批量导入待补。"
      columns={columns}
      dataSource={dataSource}
    />
  );
}
