import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { LoggerService } from './logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private zone: NgZone,
    private loggerService: LoggerService
  ) {}

  handleError(error: any): void {
    // NgZoneを使用して、Angularのライフサイクル内でエラーログを記録
    this.zone.run(() => {
      this.loggerService.logError(error, 'global-error-handler');
    });

    // 開発環境ではコンソールにもエラーを表示（デフォルトの動作）
    console.error('Error from global error handler', error);
  }
}