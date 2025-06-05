import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  constructor(private http: HttpClient) {}

  // ユーザーアクションログを記録
  logUserAction(action: string, details: any = {}): void {
    if (!environment.logging.userActions.enabled) return;
    
    const logData = {
      timestamp: new Date().toISOString(),
      action,
      details,
      userId: this.getUserId(),
      sessionId: this.getSessionId()
    };

    if (environment.logging.userActions.console) {
      console.log('[User Action]', logData);
    }

    if (environment.logging.userActions.server) {
      const serverPath = environment.logging.userActions.serverPath || '/logs/user-actions';
      this.http.post(`${environment.apiUrl}${serverPath}`, logData).subscribe({
        error: (err) => console.error('Failed to send user action log to server', err)
      });
    }
  }

  // アプリケーションエラーログを記録
  logError(error: Error | string, source: string, details: any = {}): void {
    if (!environment.logging.errors.enabled) return;
    
    const logData = {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      source,
      details,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      logFilePath: null // バックエンド側で設定されるため、nullを送信
    };

    if (environment.logging.errors.console) {
      console.error('[Application Error]', logData);
    }

    if (environment.logging.errors.server) {
      const serverPath = environment.logging.errors.serverPath || '/logs/errors';
      this.http.post(`${environment.apiUrl}${serverPath}`, logData).subscribe({
        error: (err) => console.error('Failed to send error log to server', err)
      });
    }
  }

  // ユーザーIDを取得（認証サービスから取得するなど）
  private getUserId(): string | null {
    // 実際の実装ではAuthServiceなどから取得
    return localStorage.getItem('userId');
  }

  // セッションIDを取得または生成
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  // シンプルなセッションID生成
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}