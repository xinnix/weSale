import { Form, Input, Switch, InputNumber } from 'antd';

interface AgentFormProps {
  form: any;
  isEdit?: boolean;
}

export const AgentForm = ({ form, isEdit = false }: AgentFormProps) => {
  return (
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
        <Input placeholder="例如：客服助手" />
      </Form.Item>

      <Form.Item name="slug" label="标识" rules={[{ required: true, message: '请输入标识' }]}>
        <Input placeholder="例如：customer-service" disabled={isEdit} />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea placeholder="Agent 功能描述" rows={2} />
      </Form.Item>

      <Form.Item name="icon" label="图标">
        <Input placeholder="图标名称或 URL" />
      </Form.Item>

      <Form.Item
        name="difyApiUrl"
        label="Dify API 地址"
        rules={[{ required: true, message: '请输入 API 地址' }]}
      >
        <Input placeholder="https://api.dify.ai/v1" />
      </Form.Item>

      <Form.Item
        name="difyApiKey"
        label="Dify API Key"
        rules={[{ required: !isEdit, message: '请输入 API Key' }]}
      >
        <Input.Password placeholder={isEdit ? '留空则不修改' : '请输入 API Key'} />
      </Form.Item>

      <Form.Item name="difyAppType" label="Dify App 类型">
        <Input placeholder="agent" />
      </Form.Item>

      <Form.Item name="sort" label="排序">
        <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item name="isActive" label="启用" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
};
