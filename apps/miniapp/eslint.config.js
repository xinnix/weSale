import uni from '@uni-helper/eslint-config'
import prettierConfig from 'eslint-config-prettier'

// uni() 返回 Promise；eslint-config-prettier 关闭其余所有与 prettier
// 冲突的规则（含 vue stylistic），必须追加在配置数组最后
export default (async () => {
  const configs = await uni({
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
  configs.push(prettierConfig)
  return configs
})()
