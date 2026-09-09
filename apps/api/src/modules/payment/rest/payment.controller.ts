import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  Headers,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WechatPayService } from '../services/wechat-pay.service';
import { OrderService } from '../../product/services/order.service';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly wechatPayService: WechatPayService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * 微信支付回调通知
   * 微信服务器在用户支付成功后主动调用此接口。
   * 无需 JWT 认证，通过签名验证确保请求来自微信。
   */
  @Post('wechat/callback')
  async wechatCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      this.logger.error('回调缺少 rawBody');
      return res.status(500).json({ code: 'FAIL', message: '缺少请求体' });
    }

    try {
      const payment = await this.wechatPayService.handleCallback(rawBody, {
        'wechatpay-timestamp': headers['wechatpay-timestamp'],
        'wechatpay-nonce': headers['wechatpay-nonce'],
        'wechatpay-signature': headers['wechatpay-signature'],
        'wechatpay-serial': headers['wechatpay-serial'],
      });

      // 幂等入账编排：金额不符/状态非法时抛错 → 返回 FAIL 让微信重试（重放幂等）
      const order = await this.orderService.markPaidByOrderNo(
        payment.orderNo,
        payment.transactionId,
        payment.amount,
      );

      res.status(200).send();
      this.logger.log(`支付入账完成: ${payment.orderNo} → ${order.status}`);
    } catch (error: any) {
      this.logger.error('支付回调处理失败', error);
      if (!res.headersSent) {
        res.status(500).json({ code: 'FAIL', message: '处理失败' });
      }
    }
  }

  /**
   * 微信退款回调通知
   */
  @Post('wechat/refund-callback')
  async refundCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      this.logger.error('退款回调缺少 rawBody');
      return res.status(500).json({ code: 'FAIL', message: '缺少请求体' });
    }

    try {
      const refund = await this.wechatPayService.handleRefundCallback(rawBody, {
        'wechatpay-timestamp': headers['wechatpay-timestamp'],
        'wechatpay-nonce': headers['wechatpay-nonce'],
        'wechatpay-signature': headers['wechatpay-signature'],
        'wechatpay-serial': headers['wechatpay-serial'],
      });

      // 仅退款成功推进 REFUNDED；CLOSED/ABNORMAL 保留 REFUNDING 供人工处理
      if (refund.refundStatus === 'SUCCESS') {
        await this.orderService.handleRefundCallback(refund.orderNo);
      }

      res.status(200).send();
      this.logger.log(`退款回调处理完成: ${refund.orderNo} → ${refund.refundStatus}`);
    } catch (error: any) {
      this.logger.error('退款回调处理失败', error);
      if (!res.headersSent) {
        res.status(500).json({ code: 'FAIL', message: '处理失败' });
      }
    }
  }

  /**
   * 主动查询微信支付订单状态
   */
  @Get('status/:orderNo')
  async getStatus(@Param('orderNo') orderNo: string) {
    if (!orderNo) {
      throw new BadRequestException('订单号不能为空');
    }

    try {
      const result = await this.wechatPayService.queryOrder(orderNo);
      return { status: result.status, transactionId: result.transactionId };
    } catch (error: any) {
      this.logger.error(`查询订单状态失败: ${orderNo}`, error);
      throw new BadRequestException('查询订单状态失败');
    }
  }
}
