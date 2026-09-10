<script setup lang="ts">
import type { MallAddress } from '@/api/mall'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { mallApi } from '@/api/mall'

definePage({
  style: {
    navigationStyle: 'default',
    navigationBarBackgroundColor: '#F5FAFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '编辑收货地址',
    backgroundColor: '#F5FAFF',
  },
})

const addressId = ref('')
const saving = ref(false)

const form = ref({
  receiver: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false,
})

onLoad(async (options: any) => {
  if (options?.id) {
    addressId.value = options.id
    try {
      const res = await mallApi.listAddresses()
      const existing = (res.data || []).find((a: MallAddress) => a.id === options.id)
      if (existing) {
        form.value = {
          receiver: existing.receiver,
          phone: existing.phone,
          province: existing.province,
          city: existing.city,
          district: existing.district,
          detail: existing.detail,
          isDefault: existing.isDefault,
        }
      }
    } catch (error) {
      console.error('加载地址失败:', error)
    }
  }
})

function onRegionChange(event: any) {
  const [province, city, district] = event.detail.value || []
  form.value.province = province || ''
  form.value.city = city || ''
  form.value.district = district || ''
}

async function save() {
  if (!form.value.receiver) {
    uni.showToast({ title: '请填写收货人', icon: 'none' })
    return
  }
  if (!/^1[3-9]\d{9}$/.test(form.value.phone)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return
  }
  if (!form.value.province || !form.value.detail) {
    uni.showToast({ title: '请完善所在地区和详细地址', icon: 'none' })
    return
  }

  saving.value = true
  try {
    if (addressId.value) {
      await mallApi.updateAddress(addressId.value, form.value)
    } else {
      await mallApi.createAddress(form.value)
    }
    uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page-root">
    <view class="card mx-4 mt-4 rounded-xl">
      <view class="form-row">
        <text class="label"> 收货人 </text>
        <input v-model="form.receiver" class="input" placeholder="姓名" placeholder-class="ph" />
      </view>
      <view class="form-row">
        <text class="label"> 手机号 </text>
        <input
          v-model="form.phone"
          class="input"
          type="number"
          :maxlength="11"
          placeholder="11 位手机号"
          placeholder-class="ph"
        />
      </view>
      <view class="form-row">
        <text class="label"> 所在地区 </text>
        <picker mode="region" class="input" @change="onRegionChange">
          <view>
            <text :class="form.province ? 'text-on-surface' : 'ph'">
              {{
                form.province
                  ? `${form.province} ${form.city} ${form.district}`
                  : '请选择省 / 市 / 区'
              }}
            </text>
          </view>
        </picker>
      </view>
      <view class="form-row">
        <text class="label"> 详细地址 </text>
        <input
          v-model="form.detail"
          class="input"
          placeholder="街道、门牌号等"
          placeholder-class="ph"
        />
      </view>
      <view class="form-row">
        <text class="label"> 设为默认 </text>
        <switch
          :checked="form.isDefault"
          color="#00aeef"
          class="ml-auto"
          @change="form.isDefault = !form.isDefault"
        />
      </view>
    </view>

    <view class="mt-6 px-4">
      <view class="save-btn" :class="{ disabled: saving }" @tap="save">
        <text class="save-btn-text"> 保存 </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-root {
  min-height: 100vh;
  padding-bottom: 60rpx;
  background-color: #f5faff;
}

.card {
  background: rgba(255, 255, 255, 0.95);
  border: 1rpx solid rgba(189, 200, 209, 0.2);
}

.form-row {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;

  & + .form-row {
    border-top: 1rpx solid rgba(189, 200, 209, 0.15);
  }
}

.label {
  width: 160rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #171c20;
  flex-shrink: 0;
}

.input {
  flex: 1;
  font-size: 28rpx;
  color: #171c20;
}

.ph {
  color: rgba(110, 120, 129, 0.5);
}

.save-btn {
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

.save-btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>
