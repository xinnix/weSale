import { Form, Input, Switch, Select, Space, Tag } from 'antd';
import { useEffect } from 'react';

interface Role {
  id: string;
  name: string;
  slug: string;
  level: number;
  description?: string;
}

interface AdminFormProps {
  form: any;
  isEdit: boolean;
  roles?: Role[];
  currentRoles?: string[]; // 当前管理员的角色 ID 列表（编辑时使用）
}

export const AdminForm: React.FC<AdminFormProps> = ({
  form,
  isEdit,
  roles = [],
  currentRoles = [],
}) => {
  // 编辑模式下，初始化角色字段
  useEffect(() => {
    if (isEdit && currentRoles.length > 0) {
      form.setFieldValue('roleIds', currentRoles);
    }
  }, [isEdit, currentRoles, form]);

  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="username"
        label="用户名"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input placeholder="请输入用户名" />
      </Form.Item>

      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input placeholder="请输入邮箱" />
      </Form.Item>

      {!isEdit && (
        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码至少 8 个字符' },
          ]}
        >
          <Input.Password placeholder="请输入密码（至少 8 个字符）" />
        </Form.Item>
      )}

      <Form.Item name="firstName" label="名">
        <Input placeholder="请输入名" />
      </Form.Item>

      <Form.Item name="lastName" label="姓">
        <Input placeholder="请输入姓" />
      </Form.Item>

      <Form.Item name="roleIds" label="角色">
        <Select
          mode="multiple"
          placeholder="请选择角色"
          optionFilterProp="label"
          style={{ width: '100%' }}
          options={roles.map((role) => ({
            value: role.id,
            label: (
              <Space>
                <Tag color={role.level <= 5 ? 'red' : role.level <= 10 ? 'blue' : 'default'}>
                  {role.name}
                </Tag>
                <span style={{ fontSize: 12, color: '#999' }}>{role.slug}</span>
              </Space>
            ),
          }))}
        />
      </Form.Item>

      <Form.Item name="isActive" label="启用状态" valuePropName="checked" initialValue={true}>
        <Switch checkedChildren="启用" unCheckedChildren="停用" />
      </Form.Item>
    </Form>
  );
};
