import { config } from '../config';
import { layout } from './layout';

export type TemplateName =
  | 'verify_email'
  | 'reset_password'
  | 'welcome'
  | 'password_changed'
  | 'new_sign_in'
  | 'passkey_added'
  | 'account_deleted'
  | 'test';

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const brand = () => config.brandName;
const account = (path = '/account') => `${config.publicUrl}${path}`;
const minutesUntil = (iso?: string) => (iso ? Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60000)) : undefined);
const when = (iso?: string) =>
  new Date(iso ?? Date.now()).toUTCString().replace('GMT', 'UTC');

/** Short, readable device label from a user agent string. */
export function describeDevice(ua?: string): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

export function render(template: TemplateName, d: Record<string, any>): Rendered {
  const hi = d.name ? `Hi ${String(d.name).split(' ')[0]},` : 'Hi,';
  switch (template) {
    case 'verify_email': {
      const hours = Math.round((minutesUntil(d.expiresAt) ?? 1440) / 60);
      return {
        subject: `Confirm your email for ${brand()}`,
        ...layout({
          eyebrow: 'Verify email',
          title: 'One click to | confirm it’s you.',
          paragraphs: [hi, `Confirm ${d.email} to finish setting up your ${brand()} account. The link expires in ${hours} hours.`],
          action: { label: 'Confirm email', url: d.verifyUrl },
          footnote: 'Didn’t create an account? You can ignore this email.',
        }),
      };
    }
    case 'reset_password':
      return {
        subject: `Reset your ${brand()} password`,
        ...layout({
          eyebrow: 'Password reset',
          title: 'Let’s get you | back in.',
          paragraphs: [hi, `Someone asked to reset the password for ${d.email}. If that was you, choose a new one below. The link works once and expires in ${minutesUntil(d.expiresAt) ?? 30} minutes.`],
          facts: d.ip ? [['Requested from', d.ip], ['Time', when()]] : undefined,
          action: { label: 'Choose a new password', url: d.resetUrl },
          footnote: 'Didn’t ask for this? Your password is unchanged; ignore this email.',
        }),
      };
    case 'welcome':
      return {
        subject: `Welcome to ${brand()}`,
        ...layout({
          eyebrow: 'Account ready',
          title: 'You’re | all set.',
          paragraphs: [hi, `Your email is confirmed. You can now use one ${brand()} account to sign in to every connected app.`, 'For faster, phishing-proof sign-in, add a passkey from your account security settings.'],
          action: { label: 'Open your account', url: account() },
        }),
      };
    case 'password_changed':
      return {
        subject: `Your ${brand()} password was changed`,
        ...layout({
          eyebrow: 'Security notice',
          title: 'Password | changed.',
          paragraphs: [hi, `The password for ${d.email} was just changed, and other devices were signed out.`, 'If this wasn’t you, reset your password immediately and review your active sessions.'],
          facts: [['Time', when(d.occurredAt)], ...(d.ip ? ([['IP address', d.ip]] as [string, string][]) : [])],
          action: { label: 'Review security', url: account('/account/security') },
        }),
      };
    case 'new_sign_in':
      return {
        subject: `New sign-in to your ${brand()} account`,
        ...layout({
          eyebrow: 'New sign-in',
          title: 'Was | this you?',
          paragraphs: [hi, `We noticed a sign-in to ${d.email} from a device we haven’t seen before.`],
          facts: [
            ['Device', describeDevice(d.userAgent)],
            ['IP address', d.ip ?? 'Unknown'],
            ['Method', d.method === 'passkey' ? 'Passkey' : 'Password'],
            ['Time', when(d.occurredAt)],
          ],
          action: { label: 'Review sessions', url: account('/account/security') },
          footnote: 'If this was you, there’s nothing to do. If not, change your password now.',
        }),
      };
    case 'passkey_added':
      return {
        subject: `A passkey was added to your ${brand()} account`,
        ...layout({
          eyebrow: 'Security notice',
          title: 'New passkey | added.',
          paragraphs: [hi, `A new passkey can now sign in to ${d.email}. If you didn’t add it, remove it and change your password.`],
          facts: [['Time', when(d.occurredAt)]],
          action: { label: 'Manage passkeys', url: account('/account/security') },
        }),
      };
    case 'account_deleted':
      return {
        subject: `Your ${brand()} account was deleted`,
        ...layout({
          eyebrow: 'Account closed',
          title: 'Sorry to | see you go.',
          paragraphs: [hi, `Your ${brand()} account (${d.email}) and its sign-in data have been deleted. Apps you used it with may keep their own copies of your data.`],
        }),
      };
    case 'test':
      return {
        subject: `${brand()} email test`,
        ...layout({
          eyebrow: 'Delivery test',
          title: 'Email is | working.',
          paragraphs: ['If you can read this, outgoing email from the notification service is configured correctly.'],
          facts: [['Sent', when()], ['SMTP host', config.smtp.host || 'not configured']],
        }),
      };
  }
}
