<script setup lang="ts">
import { authApi } from '@/api/auth'
import GlobalLoading from '@/components/GlobalLoading.vue'
import { useLoading } from '@/stores/loading'

const { state: loadingState } = useLoading()

onLaunch(() => {
  silentWechatLogin()
})

/**
 * 静默微信登录：KF 订单卡片/商城直购链路的前置（微信 openid 静默注册）。
 * 非微信平台或失败时静默跳过，由页面各自的登录引导兜底。
 */
async function silentWechatLogin() {
  if (uni.getStorageSync('token')) return
  try {
    const codeRes = await uni.login({ provider: 'weixin' })
    if (!codeRes.code) return

    const res = await authApi.wechatLogin(codeRes.code)
    uni.setStorageSync('token', res.data.accessToken)
    uni.setStorageSync('refreshToken', res.data.refreshToken)
    uni.setStorageSync('userInfo', res.data.user)
  } catch {
    // 静默失败不提示，保持未登录态
  }
}
</script>

<template>
  <!-- 全局 Loading 组件 -->
  <GlobalLoading :visible="loadingState.isVisible" :text="loadingState.text" />
</template>

<style lang="scss">
/* 引入字体图标 */
@import './static/iconfont/iconfont.css';

/* 引入 SVG 图标 */
@import './static/iconfont/iconfont-weapp/iconfont-weapp-icon.css';

/* 全局页面样式 - 禁止页面横向滚动 */
page {
  background-color: #f5faff;
  width: 100vw;
  max-width: 100vw;
  overflow-x: hidden;
  overflow-y: auto;
}

/* 移除全局 view 的溢出限制，让各个组件自己控制 */
/* 这样首页的优惠券横向滚动就能正常工作 */

/* 字体图标基础样式 - 只设置字体大小,颜色由各组件控制 */
.iconfont {
  font-size: 28px;
}

/* SVG 图标样式 - 只能改变大小，不能改变颜色 */
.t-icon {
  width: 28px !important;
  height: 28px !important;
  background-size: contain !important;
}
</style>
