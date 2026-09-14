import { Alert, Card, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Title, Paragraph } = Typography;

export interface PlaceholderPageProps<T extends object> {
  /** 页面标题 */
  title: string;
  /** 功能说明（一句到两句话，说明该模块规划定位） */
  description: string;
  /** 后端/实现状态提示（缺什么、待补什么） */
  hint?: string;
  columns: ColumnsType<T>;
  dataSource: T[];
}

/**
 * 占位页：功能规划中、后端待补时先呈现结构预览（静态示例数据）。
 * 让管理端信息架构先立起来，后续接真实 API 时替换 dataSource 即可。
 */
export function PlaceholderPage<T extends object>({
  title,
  description,
  hint,
  columns,
  dataSource,
}: PlaceholderPageProps<T>) {
  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>
        {title}
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {description}
      </Paragraph>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="功能规划中 · 以下为结构预览（示例数据）"
        description={hint}
      />
      <Card bordered={false}>
        <Table<T>
          columns={columns}
          dataSource={dataSource}
          rowKey={(_, index) => String(index)}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
