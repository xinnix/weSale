# Admin UI (React + Refine + Ant Design)

## 架构

- **Refine** — 数据框架，提供 useTable/useCreate/useUpdate/useDelete 等 hooks
- **Ant Design** — UI 组件库
- **tRPC Client** — 强类型调用后端 API

## 关键模式

### 列表页使用 StandardListPage 模式

每个列表页遵循相同结构：useTable + modal 创建/编辑 + 搜索/筛选 + 批量操作。

### 表单使用 StandardForm 模式

声明式表单，通过 FieldDefinition[] 配置字段类型和验证规则。

## 目录结构

```
src/
├── modules/<name>/
│   ├── pages/
│   │   └── <Name>ListPage.tsx
│   ├── components/
│   │   ├── <Name>Form.tsx
│   │   └── <Name>Detail.tsx
│   └── index.ts
├── shared/
│   ├── components/       # StandardListPage, StandardForm
│   ├── layouts/          # AdminLayout（菜单配置）
│   └── constants/        # enums.ts
└── types/                # tRPC 类型定义
```

## 注意事项

- 页面在 `App.tsx` 中注册为 Refine resource + Route
- 菜单项在 `AdminLayout.tsx` 的 menuItems 中添加
- 表单提交后调用 `invalidateQueries` 刷新列表
- 日期字段需要 dayjs 转换
- 图片字段使用 Upload 组件 + FileStorageService
