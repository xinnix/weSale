import { Form, Input, InputNumber, Switch } from 'antd';

interface WecomConfigFormProps {
  form: any;
  isEdit: boolean;
}

export const WecomConfigForm = ({ form, isEdit }: WecomConfigFormProps) => {
  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="应用名称"
        rules={[{ required: true, message: '请输入应用名称' }]}
      >
        <Input placeholder="例如：客服助手" />
      </Form.Item>

      <Form.Item
        name="corpId"
        label="企业 ID (CorpId)"
        rules={[{ required: true, message: '请输入企业ID' }]}
      >
        <Input placeholder="例如：ww1234567890abcdef" />
      </Form.Item>

      <Form.Item
        name="agentId"
        label="应用 AgentId"
        rules={[{ required: true, message: '请输入 AgentId' }]}
      >
        <InputNumber placeholder="例如：1000002" style={{ width: '100%' }} min={1} />
      </Form.Item>

      <Form.Item
        name="secret"
        label="应用 Secret"
        rules={[{ required: !isEdit, message: '请输入 Secret' }]}
      >
        <Input.Password placeholder={isEdit ? '留空则不修改' : '请输入 Secret'} />
      </Form.Item>

      <Form.Item
        name="token"
        label="回调 Token"
        rules={[{ required: true, message: '请输入回调 Token' }]}
      >
        <Input placeholder="在企业微信后台配置的 Token" />
      </Form.Item>

      <Form.Item
        name="encodingAESKey"
        label="EncodingAESKey"
        rules={[
          { required: true, message: '请输入 EncodingAESKey' },
          { len: 43, message: 'EncodingAESKey 必须为 43 个字符' },
        ]}
      >
        <Input placeholder="43个字符的 EncodingAESKey" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea rows={3} placeholder="应用描述（可选）" />
      </Form.Item>

      <Form.Item name="isActive" label="启用" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
};
