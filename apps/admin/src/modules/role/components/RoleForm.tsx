// apps/admin/src/modules/role/components/RoleForm.tsx
import { Form, Input } from 'antd';

interface RoleFormProps {
  form: any;
  isEdit?: boolean;
  isSystemRole?: boolean;
}

/**
 * 角色表单
 *
 * 系统角色只允许编辑名称和描述，slug 和 level 是固定的
 */
export const RoleForm = ({ form, isSystemRole = false }: RoleFormProps) => {
  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="角色名称"
        rules={[{ required: true, message: '请输入角色名称' }]}
      >
        <Input placeholder="请输入角色名称" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea placeholder="请输入角色描述" rows={3} />
      </Form.Item>

      {isSystemRole && (
        <div style={{ color: '#999', fontSize: 12, marginTop: 16 }}>
          注：系统角色的标识（slug）和层级（level）不可修改
        </div>
      )}
    </Form>
  );
};
