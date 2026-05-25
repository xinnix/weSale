import { Module } from '@nestjs/common';
import { AgentsService } from './services/agents.service';
import { DifyService } from './services/dify.service';
import { AgentsController } from './rest/agents.controller';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, DifyService],
  exports: [AgentsService, DifyService],
})
export class AgentsModule {}
