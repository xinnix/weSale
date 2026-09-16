/**
 * OSS 直传上传工具
 *
 * 使用阿里云 OSS Post Policy 签名方式实现前端直传
 * 文档：https://help.aliyun.com/document_detail/31989.html
 */

import { trpcClient } from '../dataProvider/dataProvider';

export interface UploadCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expiration: string;
  bucket: string;
  region: string;
  endpoint: string;
  policy: string;
  signature: string;
  xOssSignatureVersion: string;
  xOssCredential: string;
}

export interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
}

export type UploadType =
  | 'merchant_logo'
  | 'news_banner'
  | 'merchant_gallery'
  | 'news_content'
  | 'avatar';

/**
 * OSS 直传上传类
 */
export class OSSUploader {
  /**
   * 上传文件到 OSS
   *
   * @param file 要上传的文件
   * @param type 上传类型（用于确定存储路径）
   * @returns 上传结果
   */
  static async upload(file: File, type: UploadType): Promise<UploadResult> {
    // 1. 获取上传凭证
    let credentials: UploadCredentials;
    try {
      credentials = await trpcClient.upload.getUploadCredentials.query({ type });
    } catch {
      // 本地存储模式不支持客户端直传 → 走服务端中转上传
      return this.uploadViaServer(file, type);
    }

    // 2. 生成文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    const fileName = `${timestamp}-${randomStr}${ext}`;
    const key = `images/${type}/${fileName}`;

    // 3. 构建 FormData
    const formData = new FormData();
    formData.append('key', key);
    formData.append('policy', credentials.policy);
    formData.append('OSSAccessKeyId', credentials.accessKeyId);
    formData.append('signature', credentials.signature);
    formData.append('success_action_status', '200'); // 返回 200 状态码
    // 仅在 STS token 存在时添加
    if (credentials.securityToken) {
      formData.append('x-oss-security-token', credentials.securityToken);
    }
    formData.append('file', file);

    // 4. 发送 POST 请求到 OSS
    const response = await fetch(credentials.endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`);
    }

    // 5. 构建文件 URL
    const url = `${credentials.endpoint}/${key}`;

    return {
      url,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  /**
   * 本地存储模式：服务端中转上传（POST /api/upload/image，multipart）
   * 返回 url 形如 {SERVER_URL}/{type}/{fileName}
   */
  static async uploadViaServer(file: File, type: UploadType): Promise<UploadResult> {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) throw new Error('登录已失效，请重新登录');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`上传失败: HTTP ${res.status}`);
    }
    const json = await res.json();
    const data = json?.data ?? json;
    if (!data?.url) throw new Error('上传响应缺少 url');

    return { url: data.url, fileName: file.name, fileSize: file.size };
  }

  /**
   * 批量上传文件
   *
   * @param files 文件列表
   * @param type 上传类型
   * @returns 上传结果列表
   */
  static async uploadMultiple(files: File[], type: UploadType): Promise<UploadResult[]> {
    return Promise.all(files.map((file) => this.upload(file, type)));
  }

  /**
   * 验证文件类型
   *
   * @param file 文件
   * @param allowedTypes 允许的 MIME 类型
   * @returns 是否合法
   */
  static validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type);
  }

  /**
   * 验证文件大小
   *
   * @param file 文件
   * @param maxSize 最大大小（字节）
   * @returns 是否合法
   */
  static validateFileSize(file: File, maxSize: number): boolean {
    return file.size <= maxSize;
  }
}
