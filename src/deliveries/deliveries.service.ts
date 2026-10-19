import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { config } from '../config';
import { BusPublisher } from '../bus/publisher';
import { DomainEvent } from '../bus/consumer';
import { DatabaseService } from '../database/database.service';
import { describeDevice, render, TemplateName } from '../templates/templates';
import { ChannelNotConfigured, EmailChannel } from './email.channel';

/** Which email each domain event produces. */
const RULES: Record<string, TemplateName> = {
  'auth.email.verification_requested': 'verify_email',
  'auth.password.reset_requested': 'reset_password',
  'auth.email.verified': 'welcome',
  'auth.password.changed': 'password_changed',
  'auth.passkey.added': 'passkey_added',
  'auth.user.deleted': 'account_deleted',
  'auth.user.signed_in': 'new_sign_in',
};

export const SUBSCRIBED_EVENTS = Object.keys(RULES);

// 1 min, 5 min, 30 min, 2 h between attempts.
const BACKOFF_MINUTES = [1, 5, 30, 120];

interface Delivery {
  id: string;
  event: string;
  channel: string;
  template: TemplateName;
  user_id: string | null;
  to_address: string;
  subject: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  payload: Record<string, any> | null;
  correlation_id: string | null;
  created_at: Date;
  sent_at: Date | null;
}

@Injectable()
export class DeliveriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveriesService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly email: EmailChannel,
    private readonly bus: BusPublisher,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.processDue().catch((err) => this.logger.error(err.message)), 30_000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Entry point from the bus consumer. */
  async handleEvent(e: DomainEvent) {
    const template = RULES[e.event];
    if (!template) return;
    const data: Record<string, any> = { ...e.data, occurredAt: e.occurredAt };
    if (!data.email) return;

    if (template === 'new_sign_in' && !(await this.isNewDevice(String(data.userId), data.userAgent))) return;

    const rows = await this.db.query<Delivery>(
      `INSERT INTO deliveries (event_id, event, template, user_id, to_address, payload, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (event_id, channel, template) DO NOTHING RETURNING *`,
      [e.id ?? null, e.event, template, data.userId ?? null, data.email, data, e.correlationId ?? null],
    );
    if (rows[0]) await this.attempt(rows[0]);
  }

  /** Records the device; returns true only for an unseen device on an account that already had one. */
  private async isNewDevice(userId: string, userAgent?: string) {
    const fingerprint = createHash('sha256').update(describeDevice(userAgent)).digest('hex').slice(0, 32);
    const known = await this.db.query('SELECT fingerprint FROM known_devices WHERE user_id = $1', [userId]);
    const seen = known.some((k) => k.fingerprint === fingerprint);
    await this.db.query(
      `INSERT INTO known_devices (user_id, fingerprint, label) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, fingerprint) DO UPDATE SET last_seen = now()`,
      [userId, fingerprint, describeDevice(userAgent)],
    );
    return known.length > 0 && !seen;
  }

  private async attempt(d: Delivery) {
    const message = render(d.template, d.payload ?? {});
    try {
      const providerId = await this.email.send(d.to_address, message);
      await this.db.query(
        `UPDATE deliveries SET status = 'sent', attempts = attempts + 1, subject = $2, provider_message_id = $3,
           sent_at = now(), last_error = NULL, payload = NULL WHERE id = $1`,
        [d.id, message.subject, providerId],
      );
      this.bus.publish('notification.delivered', { channel: 'email', template: d.template, to: mask(d.to_address), userId: d.user_id }, d.correlation_id ?? undefined);
    } catch (err) {
      if (err instanceof ChannelNotConfigured) {
        await this.db.query(`UPDATE deliveries SET status = 'skipped', subject = $2, last_error = $3, payload = NULL WHERE id = $1`, [
          d.id,
          message.subject,
          err.message,
        ]);
        if (process.env.NODE_ENV !== 'production') {
          // Development convenience: show the email in the console so links can be clicked.
          this.logger.log(`[email not sent: SMTP unset] to ${d.to_address}\n${message.text}`);
        }
        return;
      }
      const attempts = d.attempts + 1;
      const giveUp = attempts >= config.maxAttempts;
      await this.db.query(
        `UPDATE deliveries SET attempts = $2, subject = $3, last_error = $4,
           status = CASE WHEN $5 THEN 'failed' ELSE 'retrying' END,
           next_attempt_at = now() + make_interval(mins => $6),
           payload = CASE WHEN $5 THEN NULL ELSE payload END
         WHERE id = $1`,
        [d.id, attempts, message.subject, String(err.message).slice(0, 500), giveUp, BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)]],
      );
      this.logger.warn(`Email ${d.template} to ${mask(d.to_address)} failed (attempt ${attempts}): ${err.message}`);
      if (giveUp) {
        this.bus.publish('notification.failed', { channel: 'email', template: d.template, to: mask(d.to_address), userId: d.user_id, error: String(err.message).slice(0, 200) }, d.correlation_id ?? undefined);
      }
    }
  }

  /** Retries due deliveries. SKIP LOCKED keeps two replicas from double-sending. */
  async processDue() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.db.query<Delivery>(
        `UPDATE deliveries SET next_attempt_at = now() + interval '10 minutes'
         WHERE id IN (SELECT id FROM deliveries WHERE status = 'retrying' AND next_attempt_at <= now()
                      ORDER BY next_attempt_at LIMIT 20 FOR UPDATE SKIP LOCKED)
         RETURNING *`,
      );
      for (const d of due) await this.attempt(d);
    } finally {
      this.running = false;
    }
  }

  async retry(id: string) {
    const rows = await this.db.query<Delivery>('SELECT * FROM deliveries WHERE id = $1', [id]);
    const d = rows[0];
    if (!d) throw new NotFoundException('Delivery not found.');
    if (!d.payload) return { ok: false, message: 'This message can no longer be resent (its one-time link was discarded).' };
    await this.attempt(d);
    return { ok: true };
  }

  async sendTest(to: string) {
    const rows = await this.db.query<Delivery>(
      `INSERT INTO deliveries (event, template, to_address, payload) VALUES ('notification.test', 'test', $1, '{}') RETURNING *`,
      [to],
    );
    await this.attempt(rows[0]);
    const [after] = await this.db.query<Delivery>('SELECT status, last_error FROM deliveries WHERE id = $1', [rows[0].id]);
    return { status: after.status, error: after.last_error, smtpConfigured: this.email.configured };
  }

  async list(q: { status?: string; channel?: string; q?: string; before?: string; limit?: string }) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (q.status) add('status = ?', q.status);
    if (q.channel) add('channel = ?', q.channel);
    if (q.q) add('(to_address ILIKE ? OR template ILIKE ? OR coalesce(subject, \'\') ILIKE ?)', `%${q.q}%`);
    if (q.before) add('created_at < ?', q.before);
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    params.push(limit + 1);
    const rows = await this.db.query<Delivery>(
      `SELECT * FROM deliveries ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map((d) => ({
        id: d.id,
        event: d.event,
        channel: d.channel,
        template: d.template,
        to: d.to_address,
        subject: d.subject,
        status: d.status,
        attempts: d.attempts,
        lastError: d.last_error,
        retryable: !!d.payload && d.status !== 'sent',
        createdAt: d.created_at,
        sentAt: d.sent_at,
      })),
      nextCursor: rows.length > limit ? page[page.length - 1].created_at.toISOString() : null,
    };
  }

  async stats() {
    const rows = await this.db.query(
      `SELECT status, count(*)::int AS count FROM deliveries WHERE created_at > now() - interval '7 days' GROUP BY 1`,
    );
    const byStatus = Object.fromEntries(['sent', 'retrying', 'failed', 'skipped', 'queued'].map((s) => [s, rows.find((r) => r.status === s)?.count ?? 0]));
    return { last7d: byStatus, smtpConfigured: this.email.configured };
  }
}

function mask(email: string) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}
