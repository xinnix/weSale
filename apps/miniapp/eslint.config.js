import uni from '@uni-helper/eslint-config'

export default uni({
  unocss: true,
  ignores: [
    '**/*.md',
    // 第三方生成的图标字体文件
    'src/static/iconfont/**',
  ],
})
