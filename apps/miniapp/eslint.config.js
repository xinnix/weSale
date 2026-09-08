import uni from '@uni-helper/eslint-config'

export default uni({
  unocss: true,
  ignores: [
    '**/*.md',
    // 第三方生成的图标字体文件
    'src/static/iconfont/**',
  ],
  rules: {
    // style 交由 prettier（apps/miniapp/.prettierrc）统一管理，避免两工具互相改写
    'style/brace-style': 'off',
    'style/operator-linebreak': 'off',
    'style/arrow-parens': 'off',
    'antfu/if-newline': 'off',
  },
})
