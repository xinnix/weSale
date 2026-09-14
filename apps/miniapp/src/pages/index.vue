<script setup lang="ts">
import type { MallProduct } from '@/api/mall'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { authApi } from '@/api/auth'
import { formatPrice, productApi } from '@/api/mall'

definePage({
  type: 'home',
  style: {
    enablePullDownRefresh: true,
    backgroundColor: '#F5FAFF',
  },
})

const statusBarHeight = ref(0)
const isLoggedIn = ref(false)
const userInfo = ref<any>(null)
const products = ref<MallProduct[]>([])
const loading = ref(true)

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 0
})

onShow(async () => {
  const token = uni.getStorageSync('token')
  isLoggedIn.value = !!token

  if (token && !userInfo.value) {
    try {
      const res = await authApi.getProfile()
      if (res.data) {
        userInfo.value = res.data
        uni.setStorageSync('userInfo', res.data)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  await loadProducts()
})

onPullDownRefresh(async () => {
  await loadProducts()
  uni.stopPullDownRefresh()
})

async function loadProducts() {
  loading.value = true
  try {
    const res = await productApi.listActive()
    products.value = res.data || []
  } catch (error) {
    console.error('加载商品失败:', error)
    uni.showToast({ title: '商品加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/login' })
}

function goToProfile() {
  uni.navigateTo({ url: '/pages/profile/index' })
}

function goToOrders() {
  uni.navigateTo({ url: '/pages/order/list' })
}

function goToDetail(product: MallProduct) {
  uni.navigateTo({ url: `/pages/product/detail?slug=${product.slug}` })
}
</script>

<template>
  <view class="page-root">
    <!-- 顶栏 -->
    <view
      class="top-bar-bg sticky top-0 z-50 w-full flex items-center justify-between px-4 py-3"
      :style="{ paddingTop: `${statusBarHeight}px` }"
    >
      <image class="logo-image" src="/static/logo.png" mode="aspectFit" />
      <view class="flex items-center gap-4">
        <view v-if="isLoggedIn" @tap="goToOrders">
          <text class="text-sm text-on-surface font-medium"> 我的订单 </text>
        </view>
        <view v-if="isLoggedIn" @tap="goToProfile">
          <text class="text-sm text-on-surface font-medium">
            {{ userInfo?.username || '用户' }}
          </text>
        </view>
        <view v-else @tap="goToLogin">
          <text class="text-sm text-primary font-bold"> 登录 </text>
        </view>
      </view>
    </view>

    <!-- 商品列表 -->
    <view class="px-4 pb-8">
      <view v-if="loading && products.length === 0" class="py-20 text-center">
        <text class="text-sm text-on-surface-variant"> 加载中... </text>
      </view>

      <view v-else-if="products.length === 0" class="py-20 text-center">
        <text class="text-sm text-on-surface-variant"> 暂无商品 </text>
      </view>

      <view v-else class="grid grid-cols-2 gap-3 pt-3">
        <view
          v-for="product in products"
          :key="product.id"
          class="product-card overflow-hidden rounded-xl shadow-sm"
          @tap="goToDetail(product)"
        >
          <image
            class="h-320rpx w-full"
            :src="product.coverImage || '/static/logo-mark.png'"
            mode="aspectFill"
          />
          <view class="p-3">
            <text class="block text-base text-on-surface font-bold leading-5">
              {{ product.name }}
            </text>
            <text
              v-if="product.shortDescription"
              class="line-clamp-1 mt-1 block text-xs text-on-surface-variant"
            >
              {{ product.shortDescription }}
            </text>
            <view class="mt-2 flex items-baseline gap-2">
              <text class="text-lg text-primary font-extrabold">
                ¥{{ formatPrice(product.priceFen) }}
              </text>
              <text
                v-if="product.originalPriceFen"
                class="text-xs text-on-surface-variant line-through"
              >
                ¥{{ formatPrice(product.originalPriceFen) }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-root {
  min-height: 100vh;
  background-color: #f5faff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.top-bar-bg {
  background: rgba(245, 250, 255, 0.95);
}

.logo-image {
  width: 200rpx;
  height: 80rpx;
}

.product-card {
  background: rgba(255, 255, 255, 0.95);
  border: 1rpx solid rgba(189, 200, 209, 0.2);
}
</style>
