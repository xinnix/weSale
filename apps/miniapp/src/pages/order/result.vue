<script setup lang="ts">
import type { MallOrder } from '@/api/mall'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatPrice, mallApi } from '@/api/mall'

definePage({
  style: {
    navigationStyle: 'default',
    navigationBarBackgroundColor: '#F5FAFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '支付结果',
    backgroundColor: '#F5FAFF',
  },
})

const orderNo = ref('')
const payStatus = ref<'success' | 'pending'>('pending')
const order = ref<MallOrder | null>(null)

onLoad(async (options: any) => {
  orderNo.value = options?.orderNo || ''
  payStatus.value = options?.status === 'success' ? 'success' : 'pending'

  // 支付回调为异步入账，稍等后拉一次真实订单状态
  if (orderNo.value) {
    setTimeout(fetchOrder, 1500)
  }
})

async function fetchOrder() {
  try {
    const res = await mallApi.getOrder(orderNo.value)
    order.value = res.data
    if (res.data.status !== 'PENDING') {
      payStatus.value = 'success'
    }
  } catch {
    // 状态查询失败不影响结果页展示
  }
}

function goOrders() {
  uni.redirectTo({ url: '/pages/order/list' })
}

function goHome() {
  uni.reLaunch({ url: '/pages/index' })
}
</script>

<template>
  <view class="page-root">
    <view class="result-wrap">
      <view class="icon-circle" :class="payStatus === 'success' ? 'success' : 'pending'">
        <text class="icon-text">{{ payStatus === 'success' ? '✓' : '…' }}</text>
      </view>

      <text class="title">
        {{ payStatus === 'success' ? '支付成功' : '支付处理中' }}
      </text>
      <text class="subtitle">
        {{
          payStatus === 'success'
            ? '感谢购买，商品将尽快为你安排发货'
            : '支付结果确认中，可在订单列表查看最新状态'
        }}
      </text>

      <view v-if="order" class="amount-card mt-6 rounded-xl p-4">
        <view class="flex items-center justify-between">
          <text class="text-sm text-on-surface-variant"> 订单金额 </text>
          <text class="text-lg text-primary font-extrabold">
            ¥{{ formatPrice(order.totalAmountFen) }}
          </text>
        </view>
        <view class="mt-2 flex items-center justify-between">
          <text class="text-sm text-on-surface-variant"> 订单号 </text>
          <text class="text-sm text-on-surface">{{ order.orderNo }}</text>
        </view>
      </view>
    </view>

    <view class="btn-group">
      <view class="btn primary" @tap="goOrders">
        <text class="btn-text"> 查看订单 </text>
      </view>
      <view class="btn plain" @tap="goHome">
        <text class="btn-plain-text"> 回到首页 </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-root {
  min-height: 100vh;
  background-color: #f5faff;
}

.result-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 60rpx 0;
}

.icon-circle {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  &.success {
    background: rgba(0, 174, 239, 0.12);
  }

  &.pending {
    background: rgba(110, 120, 129, 0.12);
  }
}

.icon-text {
  font-size: 72rpx;
  font-weight: 700;
  color: #00aeef;
}

.title {
  margin-top: 40rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: #171c20;
}

.subtitle {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #6e7881;
  text-align: center;
}

.amount-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  border: 1rpx solid rgba(189, 200, 209, 0.2);
}

.btn-group {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 24rpx;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid rgba(189, 200, 209, 0.2);
}

.btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &.primary {
    background: #00aeef;
    box-shadow: 0 8rpx 32rpx rgba(0, 174, 239, 0.25);
  }

  &.plain {
    border: 2rpx solid rgba(189, 200, 209, 0.6);
  }
}

.btn-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #ffffff;
}

.btn-plain-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #6e7881;
}
</style>
