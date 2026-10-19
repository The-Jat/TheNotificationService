import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const smtpPort = Number(process.env.SMTP_PORT ?? 587);

export const config = {
  port: Number(process.env.PORT ?? 4020),
  databaseUrl: required('DATABASE_URL'),
  rabbitmqUrl: required('RABBITMQ_URL'),
  internalApiKey: required('INTERNAL_API_KEY'),
  brandName: process.env.BRAND_NAME?.trim() || 'TheJat Accounts',
  /** Public URL of the accounts site, used for links in emails. */
  publicUrl: (process.env.PUBLIC_URL ?? 'https://auth.thejat.in').replace(/\/+$/, ''),
  smtp: {
    host: process.env.SMTP_HOST?.trim() || '',
    port: smtpPort,
    // 465 is implicit TLS; 587/25 upgrade with STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM?.trim() || 'TheJat Accounts <no-reply@thejat.in>',
  },
  maxAttempts: Number(process.env.MAX_ATTEMPTS ?? 5),
} as const;
