<script setup lang="ts">
import type { MallOrder, OrderStatus } from '@/api/mall'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatPrice, mallApi, ORDER_STATUS_TEXT } from '@/api/mall'

definePage({
  style: {
    navigationStyle: 'default',
    navigationBarBackgroundColor: '#F5FAFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '我的订单',
    backgroundColor: '#F5FAFF',
    enablePullDownRefresh: true,
  },
})

const TABS: { label: string; status?: OrderStatus }[] = [
  { label: '全部' },
  { label: '待支付', status: 'PENDING' },
  { label: '已支付', status: 'PAID' },
  { label: '已完成', status: 'COMPLETED' },
]

const activeTab = ref(0)
const orders = ref<MallOrder[]>([])
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)

onShow(() => {
  reload()
})

onPullDownRefresh(async () => {
  await reload()
  uni.stopPullDownRefresh()
})

async function reload() {
  page.value = 1
  orders.value = []
  await loadPage()
}

async function loadPage() {
  if (loading.value) return
  loading.value = true
  try {
    const tab = TABS[activeTab.value]
    const res = await mallApi.listOrders({
      page: page.value,
      limit: 10,
      status: tab.status,
    })
    orders.value = page.value === 1 ? res.data : [...orders.value, ...res.data]
    totalPages.value = res.totalPages || 1
  } catch (error) {
    console.error('加载订单失败:', error)
    uni.showToast({ title: '订单加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchTab(index: number) {
  if (activeTab.value === index) return
  activeTab.value = index
  reload()
}

function loadMore() {
  if (page.value < totalPages.value) {
    page.value += 1
    loadPage()
  }
}

function payOrder(order: MallOrder) {
  uni.navigateTo({ url: `/pages/order/confirm/index?orderNo=${order.orderNo}` })
}

function openResult(order: MallOrder) {
  uni.navigateTo({
    url: `/pages/order/result?orderNo=${order.orderNo}&status=${order.status === 'PENDING' ? 'pending' : 'success'}`,
  })
}
</script>

<template>
  <view class="page-root">
    <!-- 状态 Tab -->
    <view class="tabs">
      <view
        v-for="(tab, index) in TABS"
        :key="tab.label"
        class="tab-item"
        :class="{ active: activeTab === index }"
        @tap="switchTab(index)"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <view v-if="orders.length === 0" class="py-20 text-center">
      <text class="text-sm text-on-surface-variant"> 暂无订单 </text>
    </view>

    <!-- 订单列表 -->
    <view v-else class="px-4 pb-8">
      <view
        v-for="order in orders"
        :key="order.id"
        class="card mt-3 rounded-xl p-4"
        @tap="openResult(order)"
      >
        <view class="flex items-center justify-between">
          <text class="text-xs text-on-surface-variant"> {{ order.orderNo }} </text>
          <text
            class="text-sm font-bold"
            :class="order.status === 'PENDING' ? 'text-primary' : 'text-on-surface-variant'"
          >
            {{ ORDER_STATUS_TEXT[order.status] }}
          </text>
        </view>

        <view class="mt-3 flex gap-3">
          <image
            class="h-120rpx w-120rpx rounded-lg"
            :src="order.product?.coverImage || '/static/logo.png'"
            mode="aspectFill"
          />
          <view class="flex-1">
            <text class="block text-base text-on-surface font-bold">
              {{ order.product?.name || '商品已下架' }}
            </text>
            <text class="mt-1 block text-xs text-on-surface-variant">
              数量 ×{{ order.quantity }}
            </text>
            <text class="mt-1 block text-base text-primary font-extrabold">
              ¥{{ formatPrice(order.totalAmountFen) }}
            </text>
          </view>
        </view>

        <view v-if="order.status === 'PENDING'" class="mt-3 flex justify-end">
          <view class="pay-mini-btn" @tap.stop="payOrder(order)">
            <text class="pay-mini-btn-text"> 去支付 </text>
          </view>
        </view>
      </view>

      <view v-if="page < totalPages" class="py-4 text-center" @tap="loadMore">
        <text class="text-sm text-on-surface-variant">
          {{ loading ? '加载中...' : '加载更多' }}
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-root {
  min-height: 100vh;
  background-color: #f5faff;
}

.tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1rpx solid rgba(189, 200, 209, 0.2);
}

.tab-item {
  flex: 1;
  padding: 24rpx 0;
  text-align: center;

  &.active .tab-text {
    color: #00658d;
    font-weight: 700;
    border-bottom: 4rpx solid #00aeef;
    padding-bottom: 8rpx;
  }
}

.tab-text {
  font-size: 28rpx;
  color: #6e7881;
}

.card {
  background: rgba(255, 255, 255, 0.95);
  border: 1rpx solid rgba(189, 200, 209, 0.2);
}

.pay-mini-btn {
  padding: 10rpx 36rpx;
  background: #00aeef;
  border-radius: 32rpx;
}

.pay-mini-btn-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>
