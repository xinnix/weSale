import { apiGet } from './http';

export interface ProductBrief {
  id: string;
  name: string;
  priceFen: number;
  slug: string;
}

export interface ProductCard {
  appid: string; // 小程序 appid
  title: string;
  imgUrl: string; // 卡片封面 URL（ww.sendChatMessage 用 img_url）
  page: string; // 小程序页面路径
}

export function fetchProducts(token: string): Promise<ProductBrief[]> {
  return apiGet<ProductBrief[]>('/sidebar/products', token);
}

export function fetchProductCard(token: string, productId: string): Promise<ProductCard> {
  return apiGet<ProductCard>(`/sidebar/products/${productId}/card`, token);
}
