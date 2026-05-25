import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../core/guards/jwt.guard';
import { AgentsService } from '../services/agents.service';
import { DifyService } from '../services/dify.service';

@Controller('agents')
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly difyService: DifyService,
  ) {}

  @Post(':id/chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Param('id') id: string,
    @Body() body: { query: string; conversationId?: string; inputs?: Record<string, any> },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const agent = await this.agentsService.findOneWithKey(id);
    if (!agent) throw new NotFoundException('Agent not found');
    if (!agent.isActive) throw new NotFoundException('Agent is not active');

    const user = (req as any).user;
    const difyUser = `admin_${user.id}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.difyService.chatStream({
        apiUrl: agent.difyApiUrl,
        apiKey: agent.difyApiKey,
        query: body.query,
        user: difyUser,
        conversationId: body.conversationId,
        inputs: body.inputs,
      })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error: any) {
      this.logger.error(`Chat stream error: ${error.message}`);
      res.write(`data: ${JSON.stringify({ event: 'error', message: error.message })}\n\n`);
    }

    res.end();
  }

  @Post(':id/user-chat')
  @UseGuards(JwtAuthGuard)
  async userChat(
    @Param('id') id: string,
    @Body() body: { query: string; conversationId?: string; inputs?: Record<string, any> },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = (req as any).user;
    if (user.type !== 'user') {
      res.status(403).json({ message: 'Only user accounts can access this endpoint' });
      return;
    }

    const agent = await this.agentsService.findOneWithKey(id);
    if (!agent) throw new NotFoundException('Agent not found');
    if (!agent.isActive) throw new NotFoundException('Agent is not active');

    const difyUser = `user_${user.id}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.difyService.chatStream({
        apiUrl: agent.difyApiUrl,
        apiKey: agent.difyApiKey,
        query: body.query,
        user: difyUser,
        conversationId: body.conversationId,
        inputs: body.inputs,
      })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error: any) {
      this.logger.error(`User chat stream error: ${error.message}`);
      res.write(`data: ${JSON.stringify({ event: 'error', message: error.message })}\n\n`);
    }

    res.end();
  }

  @Post(':id/stop')
  @UseGuards(JwtAuthGuard)
  async stop(@Param('id') id: string, @Body() body: { taskId: string }, @Req() req: Request) {
    const agent = await this.agentsService.findOneWithKey(id);
    if (!agent) throw new NotFoundException('Agent not found');

    const user = (req as any).user;
    const userType = user.type || 'admin';
    const difyUser = userType === 'user' ? `user_${user.id}` : `admin_${user.id}`;

    return this.difyService.stopGeneration(
      agent.difyApiUrl,
      agent.difyApiKey,
      body.taskId,
      difyUser,
    );
  }
}
