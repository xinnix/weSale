<script setup lang="ts">
import type { MallAddress } from '@/api/mall'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { mallApi } from '@/api/mall'

definePage({
  style: {
    navigationStyle: 'default',
    navigationBarBackgroundColor: '#F5FAFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '收货地址',
    backgroundColor: '#F5FAFF',
  },
})

// select=1：从订单确认页进入的选择模式
const selectMode = ref(false)
const addresses = ref<MallAddress[]>([])
const loading = ref(true)

onLoad((options: any) => {
  if (options && options.select === '1') selectMode.value = true
})

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const res = await mallApi.listAddresses()
    addresses.value = res.data || []
  } catch (error) {
    console.error('加载地址失败:', error)
    uni.showToast({ title: '地址加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function pick(address: MallAddress) {
  if (!selectMode.value) return
  uni.$emit('address:selected', address)
  uni.navigateBack()
}

function edit(address: MallAddress) {
  uni.navigateTo({ url: `/pages/address/edit?id=${address.id}` })
}

function add() {
  uni.navigateTo({ url: '/pages/address/edit' })
}

function remove(address: MallAddress) {
  uni.showModal({
    title: '删除地址',
    content: `确定删除「${address.receiver}」的收货地址吗？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await mallApi.deleteAddress(address.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        load()
      } catch (error: any) {
        uni.showToast({ title: error?.message || '删除失败', icon: 'none' })
      }
    },
  })
}
</script>

<template>
  <view class="page-root">
    <view v-if="loading && addresses.length === 0" class="py-20 text-center">
      <text class="text-sm text-on-surface-variant"> 加载中... </text>
    </view>

    <view v-else-if="addresses.length === 0" class="py-20 text-center">
      <text class="text-sm text-on-surface-variant"> 还没有收货地址 </text>
    </view>

    <view v-else class="px-4 pb-40">
      <view v-for="addr in addresses" :key="addr.id" class="card mt-3 rounded-xl p-4">
        <view @tap="pick(addr)">
          <view class="flex items-center gap-2">
            <text class="text-base text-on-surface font-bold">
              {{ addr.receiver }} {{ addr.phone }}
            </text>
            <view v-if="addr.isDefault" class="default-tag">
              <text class="default-tag-text"> 默认 </text>
            </view>
          </view>
          <text class="mt-1 block text-sm text-on-surface-variant">
            {{ addr.province }}{{ addr.city }}{{ addr.district }} {{ addr.detail }}
          </text>
        </view>

        <view v-if="!selectMode" class="actions mt-3 flex justify-end gap-4 pt-3">
          <text class="action-text" @tap.stop="edit(addr)"> 编辑 </text>
          <text class="action-text danger" @tap.stop="remove(addr)"> 删除 </text>
        </view>
        <view v-else class="actions mt-3 flex justify-end pt-3">
          <text class="action-text" @tap.stop="pick(addr)"> 选这个 </text>
        </view>
      </view>
    </view>

    <!-- 新增地址 -->
    <view class="bottom-bar">
      <view class="add-btn" @tap="add">
        <text class="add-btn-text"> + 新增收货地址 </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-root {
  min-height: 100vh;
  padding-bottom: 160rpx;
  background-color: #f5faff;
}

.card {
  background: rgba(255, 255, 255, 0.95);
  border: 1rpx solid rgba(189, 200, 209, 0.2);
}

.default-tag {
  padding: 2rpx 12rpx;
  background: rgba(0, 174, 239, 0.12);
  border-radius: 8rpx;
}

.default-tag-text {
  font-size: 20rpx;
  font-weight: 700;
  color: #00658d;
}

.actions {
  border-top: 1rpx solid rgba(189, 200, 209, 0.2);
}

.action-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #00658d;

  &.danger {
    color: #d94848;
  }
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

.add-btn {
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

.add-btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>
