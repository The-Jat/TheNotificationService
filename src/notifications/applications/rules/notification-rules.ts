export const NOTIFICATION_RULES = {

  'auth.user.created': {
    email: true,
    sms: false,
    push: true,
    webhook: false,
  },

  'auth.password.reset': {
    email: true,
    sms: true,
    push: false,
    webhook: false,
  },

};