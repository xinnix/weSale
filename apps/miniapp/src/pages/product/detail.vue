<script setup lang="ts">
import type { MallProduct } from '@/api/mall'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatPrice, productApi } from '@/api/mall'

definePage({
  style: {
    navigationStyle: 'default',
    navigationBarBackgroundColor: '#F5FAFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '商品详情',
    backgroundColor: '#F5FAFF',
  },
})

const product = ref<MallProduct | null>(null)
const loading = ref(true)

onLoad(async (options: any) => {
  if (!options?.slug) {
    uni.showToast({ title: '参数缺失', icon: 'none' })
    return
  }
  try {
    const res = await productApi.getBySlug(options.slug)
    product.value = res.data
  } catch (error) {
    console.error('加载商品失败:', error)
    uni.showToast({ title: '商品不存在或已下架', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function buyNow() {
  if (!product.value) return

  if (!uni.getStorageSync('token')) {
    uni.navigateTo({ url: '/pages/login' })
    return
  }
  uni.navigateTo({ url: `/pages/order/confirm/index?slug=${product.value.slug}` })
}
</script>

<template>
  <view class="page-root">
    <view v-if="loading" class="py-20 text-center">
      <text class="text-sm text-on-surface-variant"> 加载中... </text>
    </view>

    <template v-else-if="product">
      <image
        class="h-560rpx w-full"
        :src="product.coverImage || '/static/logo-mark.png'"
        mode="aspectFill"
      />

      <view class="px-4 py-4">
        <view class="flex items-baseline gap-3">
          <text class="text-2xl text-primary font-extrabold">
            ¥{{ formatPrice(product.priceFen) }}
          </text>
          <text
            v-if="product.originalPriceFen"
            class="text-sm text-on-surface-variant line-through"
          >
            ¥{{ formatPrice(product.originalPriceFen) }}
          </text>
        </view>

        <text class="mt-2 block text-xl text-on-surface font-bold">
          {{ product.name }}
        </text>
        <text v-if="product.shortDescription" class="mt-2 block text-sm text-on-surface-variant">
          {{ product.shortDescription }}
        </text>

        <view v-if="product.description" class="desc-card mt-4 rounded-xl p-4">
          <text class="block whitespace-pre-wrap text-sm text-on-surface leading-6">
            {{ product.description }}
          </text>
        </view>
      </view>

      <!-- 底部购买栏 -->
      <view class="bottom-bar">
        <view class="buy-btn" @tap="buyNow">
          <text class="buy-btn-text"> 立即购买 </text>
        </view>
      </view>
    </template>

    <view v-else class="py-20 text-center">
      <text class="text-sm text-on-surface-variant"> 商品不存在或已下架 </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-root {
  min-height: 100vh;
  padding-bottom: 140rpx;
  background-color: #f5faff;
}

.desc-card {
  background: rgba(255, 255, 255, 0.95);
  border: 1rpx solid rgba(189, 200, 209, 0.2);
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid rgba(189, 200, 209, 0.2);
}

.buy-btn {
  height: 88rpx;
  background: #00aeef;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 174, 239, 0.25);

  &:active {
    transform: scale(0.98);
  }
}

.buy-btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>
