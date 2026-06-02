import { Tag } from 'antd';

const stateConfig: Record<string, { color: string; label: string }> = {
  GREETING: { color: 'blue', label: '问候' },
  NEEDS_DISCOVERY: { color: 'cyan', label: '需求挖掘' },
  PRODUCT_MATCH: { color: 'geekblue', label: '产品匹配' },
  OBJECTION_HANDLING: { color: 'orange', label: '异议处理' },
  CLOSING: { color: 'purple', label: '促成' },
  CONVERTED: { color: 'green', label: '已转化' },
  ESCALATED: { color: 'red', label: '已转人工' },
  TIMED_OUT: { color: 'default', label: '已超时' },
};

export const SessionStateTag = ({ state }: { state: string }) => {
  const config = stateConfig[state] || { color: 'default', label: state };
  return <Tag color={config.color}>{config.label}</Tag>;
};

const intentConfig: Record<string, { color: string; label: string }> = {
  UNKNOWN: { color: 'default', label: '未知' },
  LOW: { color: 'default', label: '低' },
  MEDIUM: { color: 'blue', label: '中' },
  HIGH: { color: 'orange', label: '高' },
  CLOSING: { color: 'green', label: '临门' },
};

export const IntentLevelTag = ({ level }: { level: string }) => {
  const config = intentConfig[level] || { color: 'default', label: level };
  return <Tag color={config.color}>{config.label}</Tag>;
};

const statusConfig: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'blue', label: '活跃' },
  CONVERTED: { color: 'green', label: '已转化' },
  ESCALATED: { color: 'red', label: '已转人工' },
  ARCHIVED: { color: 'default', label: '已归档' },
};

export const ContactStatusTag = ({ status }: { status: string }) => {
  const config = statusConfig[status] || { color: 'default', label: status };
  return <Tag color={config.color}>{config.label}</Tag>;
};
