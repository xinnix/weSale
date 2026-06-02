import { Body, Controller, Ip, Post, Headers } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../../auth/decorators/decorators';
import { LandingTrackService } from '../services/landing-track.service';

class TrackPageViewDto {
  @IsString()
  @MaxLength(255)
  path!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  referrer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  utmSource?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  utmMedium?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  utmCampaign?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string | null;
}

@Controller('landing')
export class LandingTrackController {
  constructor(private readonly trackService: LandingTrackService) {}

  @Public()
  @Post('track')
  async track(
    @Body() body: TrackPageViewDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.trackService.recordView({
      ...body,
      userAgent: userAgent || null,
      ip: ip || null,
    });
    return { ok: true };
  }
}
