// Angularのサービス機能を使うために必要なインポート
import { Injectable, inject } from '@angular/core';
// Supabaseのクライアント機能と認証ユーザー型定義をインポート
import { createClient, User } from '@supabase/supabase-js';
// 環境設定（APIキーやURLなど）を読み込み
import { environment } from '../../environments/environment'; 
// リアクティブプログラミングのためのRxJSライブラリからのインポート
import { BehaviorSubject, Observable } from 'rxjs';
// ロガーサービスをインポート
import { LoggerService } from './logger.service';

// Supabaseクライアントの作成
// 環境変数からSupabaseのURLと匿名キーを取得して接続を確立
const supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

// @Injectableデコレータは、このクラスがAngularの依存性注入システムで利用可能であることを示す
@Injectable({
  providedIn: 'root' // アプリケーション全体で単一のインスタンスを提供（シングルトンパターン）
})
export class AuthService {
  // ユーザー名を保持するためのBehaviorSubject（値が変わったときに通知する特殊な変数）
  // nullの初期値を持ち、ユーザー名かnullを格納できる
  private userNameSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  
  // 外部コンポーネントがユーザー名の変更を監視できるようにするためのObservable
  // privateな変数を安全に公開するための仕組み
  public userName$: Observable<string | null> = this.userNameSubject.asObservable();
  
  // ユーザーのUUID（一意識別子）を保持するためのBehaviorSubject
  private userUuidSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  
  // 外部コンポーネントがユーザーUUIDの変更を監視できるようにするためのObservable
  public userUuid$: Observable<string | null> = this.userUuidSubject.asObservable();


  // ロガーサービスをインジェクト
  private logger = inject(LoggerService);

  // サービスが初期化されるときに実行されるコンストラクタ
  constructor() { 
    // 認証状態の変更（ログイン・ログアウトなど）を監視するリスナーを設定
    supabase.auth.onAuthStateChange((event, session) => {
      // 現在のユーザー情報を取得（存在しない場合はnull）
      const currentUser = session?.user ?? null;
      // ユーザー名を更新
      this.updateUserName(currentUser);
      // ユーザーUUIDを更新
      this.updateUserUuid(currentUser);
      
      // 認証状態変更のログを記録
      this.logger.logUserAction('auth_state_change', { 
        event, 
        userId: currentUser?.id,
        isAuthenticated: !!currentUser 
      });
    });
  }

  // ユーザー情報からユーザー名を抽出して更新するプライベートメソッド
  private updateUserName(user: User | null):void {
    // ユーザーのメタデータからユーザー名を取得（存在しない場合はnull）
    const username = user?.user_metadata?.['username'] || null;
    // BehaviorSubjectに新しい値をセット（これにより監視しているコンポーネントに通知される）
    this.userNameSubject.next(username);
  }

  // ユーザー情報からUUIDを抽出して更新するプライベートメソッド
  private updateUserUuid(user: User | null):void {
    // ユーザーからIDを取得（存在しない場合はnull）
    const uuid = user?.id || null;
    // BehaviorSubjectに新しい値をセット
    this.userUuidSubject.next(uuid);
    // デバッグ用にコンソールにUUIDを出力
    console.log(uuid);
  }

  // 新規ユーザー登録のためのパブリックメソッド
  public async signUp(username: string, email: string, password: string): Promise<{data: any; error: any}> {
    this.logger.logUserAction('signup_attempt', { username, email });
    
    // Supabaseの認証APIを使用してユーザーを登録
    const {data, error} = await supabase.auth.signUp({
      email,      // メールアドレス
      password,   // パスワード
      options: {
        data: {username},  // ユーザーメタデータにユーザー名を保存
        emailRedirectTo: environment.signUpRedirectUrl  // メール確認後のリダイレクト先URL
      }
    });

    if (error) {
      this.logger.logError(error, 'signup_failed', { username, email });
    } else {
      this.logger.logUserAction('signup_success', { username, email, userId: data?.user?.id });
    }

    // 登録結果（成功データまたはエラー）を返す
    return {data, error};
  }

  // 既存ユーザーのログイン処理を行うパブリックメソッド
  public async signIn(email: string, password: string): Promise<{data: any; error: any}> {
    this.logger.logUserAction('login_attempt', { email });
    
    // Supabaseの認証APIを使用してユーザーをログイン
    const{data, error} = await supabase.auth.signInWithPassword({email, password});

    // エラーがなければ（ログイン成功時）、ユーザー名とUUIDを更新
    if(!error) {
      this.updateUserName(data?.user ?? null);
      this.updateUserUuid(data?.user ?? null);
      this.logger.logUserAction('login_success', { 
        email, 
        userId: data?.user?.id,
        username: data?.user?.user_metadata?.['username'] 
      });
    } else {
      this.logger.logError(error, 'login_failed', { email });
    }

    // ログイン結果を返す
    return {data, error};
  }

  // ユーザーのログアウト処理を行うパブリックメソッド
  public async signOut(): Promise<{error: any}> {
    // 現在のユーザー情報を取得してログに記録
    const userId = this.userUuidSubject.getValue();
    const username = this.userNameSubject.getValue();
    this.logger.logUserAction('logout_attempt', { userId, username });
    
    // Supabaseの認証APIを使用してログアウト
    const {error} = await supabase.auth.signOut();
    
    // エラーがなければ（ログアウト成功時）、ユーザー名とUUIDをクリア
    if(!error) {
      this.updateUserName(null);
      this.updateUserUuid(null);
      this.logger.logUserAction('logout_success', { userId, username });
    } else {
      this.logger.logError(error, 'logout_failed', { userId, username });
    }
    
    // ログアウト結果を返す
    return {error};
  }

  // ユーザーが認証済みかどうかを確認するパブリックメソッド
  public async isAuthenticatedAsync(): Promise<boolean> {
    // 現在のユーザー情報を取得
    const { data } = await supabase.auth.getUser();
    
    // ユーザーが存在すればtrue、存在しなければfalseを返す
    // !!は二重否定で、値をブール型に変換するテクニック
    return !!data?.user;
  }

  // パスワードリセットリンクをメールで送信するパブリックメソッド
  public async sendResetLink(email: string): Promise<{ data:any; error:any }> {
    this.logger.logUserAction('password_reset_request', { email });
    
    // Supabaseの認証APIを使用してパスワードリセットメールを送信
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: environment.resetPasswordRedirectUrl  // パスワードリセット後のリダイレクト先URL
    });

    if (error) {
      this.logger.logError(error, 'password_reset_request_failed', { email });
    } else {
      this.logger.logUserAction('password_reset_email_sent', { email });
    }

    // 送信結果を返す
    return { data, error };
  }

  // ユーザーのパスワードを更新するパブリックメソッド
  public async resetPassword(newPassword: string): Promise<{ data: any; error: any }> {
    this.logger.logUserAction('password_reset_attempt');
    
    // Supabaseの認証APIを使用してパスワードを更新
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword  // 新しいパスワード
    });

    if (error) {
      this.logger.logError(error, 'password_reset_failed');
    } else {
      this.logger.logUserAction('password_reset_success', { userId: data?.user?.id });
    }

    // 更新結果を返す
    return { data, error };
  }
}