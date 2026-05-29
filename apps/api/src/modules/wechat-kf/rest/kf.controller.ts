import { Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../auth/decorators/decorators';
import { WechatKfCryptoService } from '../services/kf-crypto.service';
import { WechatKfService } from '../services/kf.service';

@Controller('wechat-kf')
export class KfController {
  private readonly logger = new Logger(KfController.name);

  constructor(
    private readonly kfCryptoService: WechatKfCryptoService,
    private readonly kfService: WechatKfService,
  ) {}

  /**
   * 回调 URL 验证（GET）
   * 微信客服配置回调 URL 时发送 GET 请求验证
   */
  @Public()
  @Get('callback')
  async verifyCallback(
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(
        `回调验证请求: msg_signature=${msgSignature}, timestamp=${timestamp}, nonce=${nonce}, echostr=${echostr}`,
      );
      const valid = this.kfCryptoService.verifySignatureWithEncrypt(
        timestamp,
        nonce,
        echostr,
        msgSignature,
      );
      if (!valid) {
        this.logger.warn(`回调验证签名失败 (token=${this.kfCryptoService.token})`);
        return res.status(403).send('signature verification failed');
      }

      const decrypted = this.kfCryptoService.decryptMessage(echostr);
      this.logger.log('回调验证成功');
      res.set('Content-Type', 'text/plain');
      res.send(decrypted);
    } catch (error: any) {
      this.logger.error('回调验证异常', error);
      if (!res.headersSent) {
        res.status(500).send('verification failed');
      }
    }
  }

  /**
   * 接收客服消息/事件回调（POST）
   * 收到 kf_msg_or_event 事件后，自动调 sync_msg 拉取消息并持久化
   */
  @Public()
  @Post('callback')
  async receiveCallback(
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : null);
    if (!rawBody) {
      this.logger.error(
        `回调缺少 rawBody: method=${req.method}, url=${req.url}, contentType=${req.headers['content-type']}, bodyType=${typeof req.body}`,
      );
      return res.status(400).send('missing rawBody');
    }

    try {
      const encrypt = this.kfCryptoService.extractEncryptFromXml(rawBody);

      const valid = this.kfCryptoService.verifySignatureWithEncrypt(
        timestamp,
        nonce,
        encrypt,
        msgSignature,
      );
      if (!valid) {
        this.logger.warn('消息回调签名验证失败');
        return res.status(403).send('signature verification failed');
      }

      const plainXml = this.kfCryptoService.decryptMessage(encrypt);
      const parsed = this.kfCryptoService.parseXml(plainXml);

      this.logger.log(`收到回调明文 XML:\n${plainXml}`);

      const callbackEvent = this.kfService.parseKfCallback(parsed);
      if (callbackEvent) {
        this.logger.log(
          `KF 事件通知: openKfId=${callbackEvent.openKfId}, token=${callbackEvent.token.slice(0, 8)}...`,
        );

        // 先返回 success，再异步拉取消息（避免微信超时重试）
        res.set('Content-Type', 'text/plain');
        res.send('success');

        // 异步拉取 + 持久化，不阻塞响应
        this.kfService
          .handleCallbackAndSync(callbackEvent.token, callbackEvent.openKfId)
          .catch((err) => this.logger.error('异步消息同步失败', err));
      } else {
        this.logger.log(`收到非 KF 消息事件: event=${parsed.Event}`);
        res.set('Content-Type', 'text/plain');
        res.send('success');
      }
    } catch (error: any) {
      this.logger.error('消息回调处理异常', error);
      if (!res.headersSent) {
        res.status(500).send('processing failed');
      }
    }
  }

  /**
   * JSSDK 签名端点
   * 前端页面调用微信 JS-SDK 时获取签名
   */
  @Public()
  @Get('jssdk/config')
  async getJssdkConfig(@Query('url') url: string, @Res() res: Response) {
    if (!url) {
      return res.status(400).json({ error: 'url 参数必填' });
    }

    try {
      const config = await this.kfService.generateJssdkSignature(url);
      res.json(config);
    } catch (error: any) {
      this.logger.error('生成 JSSDK 签名失败', error);
      res.status(500).json({ error: '生成签名失败' });
    }
  }
}
