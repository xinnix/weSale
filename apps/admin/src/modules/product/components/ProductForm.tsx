import { Form, InputNumber, Select } from 'antd';
import { StandardForm } from '../../../shared/components/StandardForm';
import type { FieldDefinition } from '../../../shared/components/StandardForm/types';
import type { FormProps } from '../../../shared/components/StandardListPage/types';

const billingCycleOptions = [
  { value: 'ONE_TIME', label: '一次性' },
  { value: 'MONTHLY', label: '月付' },
  { value: 'YEARLY', label: '年付' },
  { value: 'LIFETIME', label: '终身' },
];

const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'ACTIVE', label: '上架' },
  { value: 'ARCHIVED', label: '已下架' },
];

const fields: FieldDefinition[] = [
  {
    key: 'name',
    label: '产品名称',
    type: 'input',
    required: true,
    rules: [{ max: 100, message: '名称最多100个字符' }],
  },
  {
    key: 'slug',
    label: '产品标识',
    type: 'input',
    required: true,
    tooltip: '唯一标识，用于 URL 和 API 引用',
  },
  {
    key: 'shortDescription',
    label: '简短描述',
    type: 'textarea',
    tooltip: '一句话描述产品，用于产品卡片和 AI 推荐文本',
  },
  {
    key: 'description',
    label: '详细描述',
    type: 'textarea',
  },
  {
    key: 'category',
    label: '分类',
    type: 'input',
    tooltip: '产品分类，如"SaaS工具"、"企业服务"',
  },
  {
    key: 'priceFen',
    label: '价格（元）',
    type: 'number',
    required: true,
    tooltip: '以元为单位输入，系统内部以分存储',
    render: () => (
      <Form.Item
        name="priceFen"
        label="价格（元）"
        rules={[{ required: true, message: '请输入价格' }]}
        getValueProps={(v) => ({ value: typeof v === 'number' ? v / 100 : v })}
        normalize={(v) => Math.round(v * 100)}
      >
        <InputNumber
          min={0.01}
          precision={2}
          style={{ width: '100%' }}
          placeholder="0.00"
          addonAfter="元"
        />
      </Form.Item>
    ),
  },
  {
    key: 'originalPriceFen',
    label: '原价（元）',
    type: 'number',
    tooltip: '划线价，用于展示优惠',
    render: () => (
      <Form.Item
        name="originalPriceFen"
        label="原价（元）"
        getValueProps={(v) => ({ value: typeof v === 'number' ? v / 100 : v })}
        normalize={(v) => (v === null || v === undefined ? v : Math.round(v * 100))}
      >
        <InputNumber
          min={0.01}
          precision={2}
          style={{ width: '100%' }}
          placeholder="0.00"
          addonAfter="元"
        />
      </Form.Item>
    ),
  },
  {
    key: 'billingCycle',
    label: '计费周期',
    type: 'select',
    initialValue: 'ONE_TIME',
    options: billingCycleOptions,
  },
  {
    key: 'trialDays',
    label: '试用天数',
    type: 'number',
    tooltip: '0 或不填表示无试用期',
  },
  {
    key: 'coverImage',
    label: '封面图',
    type: 'upload',
  },
  {
    key: 'images',
    label: '产品图片',
    type: 'uploadMultiple',
  },
  {
    key: 'features',
    label: '产品特性',
    type: 'custom',
    tooltip: '每行一个特性，如：支持10个团队空间',
    render: () => (
      <Form.Item name="features" label="产品特性" tooltip="每行一个特性">
        <Select
          mode="tags"
          style={{ width: '100%' }}
          placeholder="输入特性后按回车添加"
          tokenSeparators={['\n']}
          open={false}
        />
      </Form.Item>
    ),
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    initialValue: 'DRAFT',
    options: statusOptions,
  },
  {
    key: 'sort',
    label: '排序',
    type: 'number',
    initialValue: 0,
  },
];

export function ProductForm({ form, isEdit }: FormProps) {
  return <StandardForm form={form} isEdit={isEdit} fields={fields} />;
}
