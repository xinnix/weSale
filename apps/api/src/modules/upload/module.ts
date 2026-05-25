import { Module } from '@nestjs/common';
import { UploadService } from './services/upload.service';
import { UploadController } from './rest/upload.controller';
import { FileStorageService } from '../../shared/services/file-storage.service';

@Module({
  providers: [UploadService, FileStorageService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
