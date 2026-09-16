import { Space, Button, message, Typography } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { StandardListPage } from '../../../shared/components/StandardListPage';
import { ProductForm } from '../components/ProductForm';
import { ProductStatusTag } from '../components/ProductStatusTag';
import { useUpdate } from '@refinedev/core';

const billingCycleLabels: Record<string, string> = {
  ONE_TIME: '一次性',
  MONTHLY: '月付',
  YEARLY: '年付',
  LIFETIME: '终身',
};

interface ProductRecord {
  id: string;
  name: string;
  slug: string;
  priceFen: number;
  originalPriceFen?: number;
  billingCycle: string;
  category?: string;
  status: string;
  sort: number;
  createdAt: string;
  [key: string]: unknown;
}

const columns: ColumnType<ProductRecord>[] = [
  { title: '产品名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '标识', dataIndex: 'slug', key: 'slug', width: 140 },
  {
    title: '价格',
    dataIndex: 'priceFen',
    key: 'priceFen',
    width: 120,
    render: (val: number, record: ProductRecord) => (
      <span>
        ¥{(val / 100).toFixed(2)}
        {record.originalPriceFen ? (
          <Typography.Text delete type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            ¥{(record.originalPriceFen / 100).toFixed(2)}
          </Typography.Text>
        ) : null}
      </span>
    ),
  },
  {
    title: '计费周期',
    dataIndex: 'billingCycle',
    key: 'billingCycle',
    width: 100,
    render: (val: string) => billingCycleLabels[val] || val,
  },
  {
    title: '分类',
    dataIndex: 'category',
    key: 'category',
    width: 100,
    render: (val: string) => val || '-',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (val: string) => <ProductStatusTag status={val} />,
  },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 60 },
];

export function ProductListPage() {
  const { mutate: updateProduct } = useUpdate();

  return (
    <StandardListPage<ProductRecord>
      resource="product"
      title="产品管理"
      columns={columns}
      formComponent={ProductForm}
      formWidth={720}
      showDefaultRowActions
      searchFields={[{ field: 'search', placeholder: '搜索产品名称/标识' }]}
      filterFields={[
        {
          field: 'status',
          type: 'select',
          placeholder: '状态',
          options: [
            { value: 'DRAFT', label: '草稿' },
            { value: 'ACTIVE', label: '上架' },
            { value: 'ARCHIVED', label: '已下架' },
          ],
        },
        {
          field: 'billingCycle',
          type: 'select',
          placeholder: '计费周期',
          options: [
            { value: 'ONE_TIME', label: '一次性' },
            { value: 'MONTHLY', label: '月付' },
            { value: 'YEARLY', label: '年付' },
            { value: 'LIFETIME', label: '终身' },
          ],
        },
      ]}
      permissions={{
        create: 'product:create',
        update: 'product:update',
        delete: 'product:delete',
      }}
      renderRowActions={(record) => (
        <Space size="small">
          {record.status === 'DRAFT' && (
            <Button
              size="small"
              type="link"
              onClick={() =>
                updateProduct(
                  {
                    resource: 'product',
                    id: record.id,
                    meta: { action: 'update' },
                    values: { status: 'ACTIVE' },
                  },
                  { onSuccess: () => message.success('产品已上架') },
                )
              }
            >
              上架
            </Button>
          )}
          {record.status === 'ACTIVE' && (
            <Button
              size="small"
              type="link"
              onClick={() =>
                updateProduct(
                  {
                    resource: 'product',
                    id: record.id,
                    meta: { action: 'update' },
                    values: { status: 'ARCHIVED' },
                  },
                  { onSuccess: () => message.success('产品已下架') },
                )
              }
            >
              下架
            </Button>
          )}
        </Space>
      )}
    />
  );
}
