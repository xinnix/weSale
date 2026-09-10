/**
 * 商城 API：商品（复用公开 products 端点）、地址、订单、支付
 */
import { API_ENDPOINTS } from '@/config/api'
import { http } from '@/utils/http'

export interface MallProduct {
  id: string
  name: string
  slug: string
  description?: string
  shortDescription?: string
  coverImage?: string
  images?: string[]
  category?: string
  priceFen: number
  originalPriceFen?: number
  features?: unknown
}

export interface MallAddress {
  id: string
  receiver: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}

export interface AddressSnapshot {
  receiver: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
}

export type OrderStatus = 'PENDING' | 'PAID' | 'COMPLETED' | 'REFUNDING' | 'REFUNDED' | 'CANCELLED'

export interface MallOrder {
  id: string
  orderNo: string
  status: OrderStatus
  quantity: number
  unitPriceFen: number
  totalAmountFen: number
  expireAt?: string
  paidAt?: string
  createdAt: string
  product?: Pick<MallProduct, 'id' | 'name' | 'slug' | 'coverImage'>
  addressSnapshot?: AddressSnapshot
}

export interface OrderListResult {
  list: MallOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** uni.requestPayment 所需支付参数 */
export interface PayParams {
  orderNo: string
  totalAmountFen: number
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  COMPLETED: '已完成',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
}

/** 分 → 元字符串 */
export function formatPrice(fen: number): string {
  return (fen / 100).toFixed(2)
}

export const productApi = {
  listActive: () => http.get<MallProduct[]>(API_ENDPOINTS.productsActive),
  getBySlug: (slug: string) => http.get<MallProduct>(API_ENDPOINTS.productDetail(slug)),
}

export const mallApi = {
  // ─── 地址 ───
  listAddresses: () => http.get<MallAddress[]>(API_ENDPOINTS.mallAddresses),
  createAddress: (data: Omit<MallAddress, 'id' | 'isDefault'> & { isDefault?: boolean }) =>
    http.post<MallAddress>(API_ENDPOINTS.mallAddresses, data),
  updateAddress: (id: string, data: Partial<MallAddress>) =>
    http.put<MallAddress>(API_ENDPOINTS.mallAddressDetail(id), data),
  deleteAddress: (id: string) => http.delete<{ id: string }>(API_ENDPOINTS.mallAddressDetail(id)),

  // ─── 订单 ───
  createOrder: (data: { productId: string; addressId: string; quantity?: number }) =>
    http.post<MallOrder>(API_ENDPOINTS.mallOrders, data),
  listOrders: (params?: { page?: number; limit?: number; status?: OrderStatus }) =>
    http.get<MallOrder[]>(API_ENDPOINTS.mallOrders, params),
  getOrder: (orderNo: string) => http.get<MallOrder>(API_ENDPOINTS.mallOrderDetail(orderNo)),
  /** KF 卡片落地：把 PENDING 无主单绑定到当前用户（幂等） */
  claimOrder: (orderNo: string) => http.post<MallOrder>(API_ENDPOINTS.mallOrderClaim(orderNo)),

  // ─── 支付 ───
  prepay: (orderNo: string) => http.post<PayParams>(API_ENDPOINTS.mallOrderPrepay(orderNo)),
}
