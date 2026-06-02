import { Module } from '@nestjs/common';
import { LandingTrackService } from './services/landing-track.service';
import { LandingTrackController } from './rest/landing-track.controller';

@Module({
  controllers: [LandingTrackController],
  providers: [LandingTrackService],
  exports: [LandingTrackService],
})
export class LandingTrackModule {}
