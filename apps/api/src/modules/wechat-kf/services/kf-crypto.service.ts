import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WecomCryptoService } from '../../wecom/services/wecom-crypto.service';

@Injectable()
export class WechatKfCryptoService {
  constructor(
    private readonly wecomCryptoService: WecomCryptoService,
    private readonly configService: ConfigService,
  ) {}

  get token(): string {
    return this.configService.get<string>('WX_WORK_KF_TOKEN', '');
  }

  get encodingAESKey(): string {
    return this.configService.get<string>('WX_WORK_KF_ENCODING_AES_KEY', '');
  }

  get corpId(): string {
    return this.configService.get<string>('WX_WORK_CORP_ID', '');
  }

  verifySignature(timestamp: string, nonce: string, msgSignature: string): boolean {
    return this.wecomCryptoService.verifySignature(this.token, timestamp, nonce, msgSignature);
  }

  verifySignatureWithEncrypt(
    timestamp: string,
    nonce: string,
    encrypt: string,
    msgSignature: string,
  ): boolean {
    return this.wecomCryptoService.verifySignatureWithEncrypt(
      this.token,
      timestamp,
      nonce,
      encrypt,
      msgSignature,
    );
  }

  decryptMessage(encryptedMsg: string): string {
    return this.wecomCryptoService.decryptMessage(this.encodingAESKey, this.corpId, encryptedMsg);
  }

  encryptMessage(replyMsg: string): string {
    return this.wecomCryptoService.encryptMessage(this.encodingAESKey, this.corpId, replyMsg);
  }

  extractEncryptFromXml(xml: string): string {
    return this.wecomCryptoService.extractEncryptFromXml(xml);
  }

  parseXml(xml: string): Record<string, string> {
    return this.wecomCryptoService.parseXml(xml);
  }

  generateEncryptedXml(replyMsg: string): string {
    return this.wecomCryptoService.generateEncryptedXml(
      this.token,
      this.encodingAESKey,
      this.corpId,
      replyMsg,
    );
  }
}
