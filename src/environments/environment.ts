export const environment = {
  supabaseUrl: 'XXX',
  supabaseAnonKey: 'XXX',
  signUpRedirectUrl: 'http://localhost/login',
  resetPasswordRedirectUrl: 'http://localhost/reset-password',
  apiUrl: '/api',
  logging: {
    userActions: {
      enabled: true,
      console: true,
      server: true,
      serverPath: '/logs/user-actions'
    },
    errors: {
      enabled: true,
      console: true,
      server: true,
      serverPath: '/logs/errors'
    }
  }
};