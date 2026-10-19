# TheJat notification service

Turns domain events into emails, and records every delivery.

| Event | Email |
|---|---|
| `auth.email.verification_requested` | Confirm your email (link) |
| `auth.password.reset_requested` | Reset your password (link) |
| `auth.email.verified` | Welcome |
| `auth.password.changed` | Security notice |
| `auth.passkey.added` | Security notice |
| `auth.user.signed_in` | New-device alert (only for devices the account hasn't used before) |
| `auth.user.deleted` | Account closed |

- Emails use an ArtCraft-styled, email-client-safe HTML layout plus a plain-text part (`src/templates`).
- Each delivery is stored with its status. Failures retry with backoff (1 min, 5 min, 30 min, 2 h) up to `MAX_ATTEMPTS`.
- One-time links are kept only until the email is sent or abandoned.
- Outcomes are published back as `notification.delivered` / `notification.failed`, so they appear in the logs.
- Without `SMTP_HOST`, deliveries are marked `skipped`. Outside production the email text is printed to the console.

SMTP works with any provider (Amazon SES, Brevo, Mailtrap, …): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

Internal API (header `x-internal-key`): `GET /internal/deliveries`, `GET /internal/stats`,
`POST /internal/deliveries/:id/retry`, `POST /internal/test-email`, plus `GET /health`.
