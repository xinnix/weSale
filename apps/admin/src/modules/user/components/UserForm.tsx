// apps/admin/src/modules/user/components/UserForm.tsx
import { Form, Input, Row, Col } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';

interface UserFormProps {
  form: any;
  isEdit?: boolean;
}

export const UserForm = ({ form, isEdit = false }: UserFormProps) => {
  return (
    <Form form={form} layout="vertical">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="firstName" label="名">
            <Input placeholder="请输入名" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="lastName" label="姓">
            <Input placeholder="请输入姓" />
          </Form.Item>
        </Col>
      </Row>

      {!isEdit && (
        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码至少8个字符' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
        </Form.Item>
      )}
    </Form>
  );
};
