<script setup lang="ts">
import type { MallAddress, MallOrder, MallProduct } from '@/api/mall'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatPrice, mallApi, ORDER_STATUS_TEXT, productApi } from '@/api/mall'

definePage({
  style: {
    navigationStyle: 'default',
    navigationBarBackgroundColor: '#F5FAFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '订单确认',
    backgroundColor: '#F5FAFF',
  },
})

// create：从商品详情发起下单；pay：KF 卡片/待支付订单直达（orderNo）
const mode = ref<'create' | 'pay'>('create')
const slug = ref('')
const orderNo = ref('')

const product = ref<MallProduct | null>(null)
const order = ref<MallOrder | null>(null)
const addresses = ref<MallAddress[]>([])
const selectedAddress = ref<MallAddress | null>(null)
const quantity = ref(1)
const submitting = ref(false)
const loading = ref(true)
const errorMsg = ref('')
// onShow 只初始化一次；地址选择返回时不覆盖已选
const inited = ref(false)

onLoad((options: any) => {
  if (options?.orderNo) {
    mode.value = 'pay'
    orderNo.value = options.orderNo
  } else if (options?.slug) {
    mode.value = 'create'
    slug.value = options.slug
  }
})

onShow(() => {
  if (inited.value) return
  if (!uni.getStorageSync('token')) {
    // 未登录先去登录（登录后 navigateBack 回到本页）
    uni.navigateTo({ url: '/pages/login' })
    return
  }
  inited.value = true
  init()
})

async function init() {
  loading.value = true
  errorMsg.value = ''
  try {
    if (mode.value === 'create') {
      const [productRes, addressRes] = await Promise.all([
        productApi.getBySlug(slug.value),
        mallApi.listAddresses(),
      ])
      product.value = productRes.data
      addresses.value = addressRes.data || []
      selectedAddress.value = addresses.value.find((a) => a.isDefault) || addresses.value[0] || null
    } else {
      // KF 卡片落地：无主单先领取（幂等），再查单
      try {
        await mallApi.claimOrder(orderNo.value)
      } catch {
        // 非无主单/已领取时忽略，查单阶段做归属与状态校验
      }
      const orderRes = await mallApi.getOrder(orderNo.value)
      order.value = orderRes.data
    }
  } catch (error: any) {
    errorMsg.value = error?.message || '订单加载失败'
  } finally {
    loading.value = false
  }
}

function chooseAddress() {
  uni.$once('address:selected', (addr: MallAddress) => {
    selectedAddress.value = addr
  })
  uni.navigateTo({ url: '/pages/address/list?select=1' })
}

function goAddAddress() {
  uni.navigateTo({ url: '/pages/address/edit' })
}

function changeQuantity(delta: number) {
  const next = quantity.value + delta
  if (next >= 1 && next <= 99) quantity.value = next
}

async function payOrder(payOrderNo: string) {
  submitting.value = true
  try {
    const res = await mallApi.prepay(payOrderNo)
    const p = res.data
    await new Promise<void>((resolve, reject) => {
      uni.requestPayment({
        provider: 'weixin',
        timeStamp: p.timeStamp,
        nonceStr: p.nonceStr,
        package: p.package,
        signType: p.signType as any,
        paySign: p.paySign,
        success: () => resolve(),
        fail: (err: any) => reject(err),
      } as any)
    })
    uni.redirectTo({ url: `/pages/order/result?orderNo=${payOrderNo}&status=success` })
  } catch (error: any) {
    if (error?.errMsg?.includes('cancel')) {
      uni.showToast({ title: '已取消支付，可在订单列表继续支付', icon: 'none' })
    } else {
      uni.showToast({ title: error?.message || '支付失败，请稍后重试', icon: 'none' })
    }
  } finally {
    submitting.value = false
  }
}

async function submitOrder() {
  if (mode.value === 'pay') {
    await payOrder(orderNo.value)
    return
  }

  if (!selectedAddress.value) {
    uni.showToast({ title: '请选择收货地址', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await mallApi.createOrder({
      productId: product.value!.id,
      addressId: selectedAddress.value.id,
      quantity: quantity.value,
    })
    await payOrder(res.data.orderNo)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '下单失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function goOrders() {
  uni.redirectTo({ url: '/pages/order/list' })
}
</script>

<template>
  <view class="page-root">
    <view v-if="loading" class="py-20 text-center">
      <text class="text-sm text-on-surface-variant"> 加载中... </text>
    </view>

    <view v-else-if="errorMsg" class="py-20 text-center">
      <text class="block text-sm text-on-surface-variant">{{ errorMsg }}</text>
      <view class="mt-4" @tap="goOrders">
        <text class="text-sm text-primary font-bold"> 查看我的订单 </text>
      </view>
    </view>

    <template v-else>
      <!-- 收货地址（仅新建订单） -->
      <template v-if="mode === 'create'">
        <view v-if="selectedAddress" class="card mx-4 mt-4 rounded-xl p-4" @tap="chooseAddress">
          <view class="flex items-start justify-between">
            <view class="flex-1">
              <text class="text-base text-on-surface font-bold">
                {{ selectedAddress.receiver }} {{ selectedAddress.phone }}
              </text>
              <text class="mt-1 block text-sm text-on-surface-variant">
                {{ selectedAddress.province }}{{ selectedAddress.city
                }}{{ selectedAddress.district }}
                {{ selectedAddress.detail }}
              </text>
            </view>
            <text class="text-sm text-primary font-bold">
              {{ addresses.length ? '更换' : '' }} ›
            </text>
          </view>
        </view>
        <view v-else class="card mx-4 mt-4 rounded-xl p-4" @tap="goAddAddress">
          <text class="text-base text-primary font-bold"> + 新增收货地址 </text>
        </view>
      </template>

      <!-- 商品/订单摘要 -->
      <view class="card mx-4 mt-4 rounded-xl p-4">
        <template v-if="mode === 'create' && product">
          <view class="flex gap-3">
            <image
              class="h-140rpx w-140rpx rounded-lg"
              :src="product.coverImage || '/static/logo-mark.png'"
              mode="aspectFill"
            />
            <view class="flex-1">
              <text class="block text-base text-on-surface font-bold">{{ product.name }}</text>
              <text class="mt-1 block text-sm text-primary font-bold">
                ¥{{ formatPrice(product.priceFen) }}
              </text>
            </view>
            <view class="stepper">
              <view class="step-btn" @tap="changeQuantity(-1)">
                <text> − </text>
              </view>
              <text class="step-num">{{ quantity }}</text>
              <view class="step-btn" @tap="changeQuantity(1)">
                <text> + </text>
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="order">
          <view class="flex items-center justify-between">
            <text class="text-base text-on-surface font-bold"> 订单 {{ order.orderNo }} </text>
            <text
              class="text-sm font-bold"
              :class="order.status === 'PENDING' ? 'text-primary' : 'text-on-surface-variant'"
            >
              {{ ORDER_STATUS_TEXT[order.status] }}
            </text>
          </view>
          <view v-if="order.product" class="mt-3 flex gap-3">
            <image
              class="h-140rpx w-140rpx rounded-lg"
              :src="order.product.coverImage || '/static/logo-mark.png'"
              mode="aspectFill"
            />
            <view class="flex-1">
              <text class="block text-base text-on-surface font-bold">
                {{ order.product.name }}
              </text>
              <text class="mt-1 block text-sm text-on-surface-variant">
                数量 ×{{ order.quantity }}
              </text>
            </view>
          </view>
          <view v-if="order.addressSnapshot" class="address-line mt-3 pt-3">
            <text class="block text-sm text-on-surface-variant">
              收货：{{ order.addressSnapshot.receiver }} {{ order.addressSnapshot.phone }}
            </text>
            <text class="block text-sm text-on-surface-variant">
              {{ order.addressSnapshot.province }}{{ order.addressSnapshot.city
              }}{{ order.addressSnapshot.district }}
              {{ order.addressSnapshot.detail }}
            </text>
          </view>
        </template>
      </view>

      <!-- 合计 -->
      <view class="card mx-4 mt-4 rounded-xl p-4">
        <view class="flex items-center justify-between">
          <text class="text-sm text-on-surface-variant"> 合计 </text>
          <text class="text-xl text-primary font-extrabold">
            ¥{{
              formatPrice(
                (mode === 'create' ? (product?.priceFen ?? 0) : (order?.totalAmountFen ?? 0)) *
                  (mode === 'create' ? quantity : 1),
              )
            }}
          </text>
        </view>
      </view>

      <!-- 底部支付栏 -->
      <view class="bottom-bar">
        <view class="pay-btn" :class="{ disabled: submitting }" @tap="submitOrder">
          <text class="pay-btn-text">
            {{ submitting ? '处理中...' : mode === 'create' ? '提交订单并支付' : '立即支付' }}
          </text>
        </view>
      </view>
    </template>
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

.address-line {
  border-top: 1rpx solid rgba(189, 200, 209, 0.2);
}

.stepper {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.step-btn {
  width: 52rpx;
  height: 52rpx;
  border-radius: 12rpx;
  background: #f0f6fb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #00658d;
}

.step-num {
  min-width: 48rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 700;
  color: #171c20;
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

.pay-btn {
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

  &.disabled {
    opacity: 0.6;
  }
}

.pay-btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>
