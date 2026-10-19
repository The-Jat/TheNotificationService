import { config } from '../config';

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const INK = '#101014';
const MUTED = '#5f5f63';
const FAINT = '#8e8e92';
const LINE = '#dcdbd7';
const BG = '#f2f1ee';
const CARD = '#faf9f7';
const MONO = `'Geist Mono','SFMono-Regular',Menlo,Consolas,monospace`;
const SANS = `'Inter','Helvetica Neue',Helvetica,Arial,sans-serif`;
const SERIF = `'Instrument Serif',Georgia,'Times New Roman',serif`;

export interface EmailParts {
  /** Small uppercase label above the headline. */
  eyebrow: string;
  /** Headline; the part after `|` renders in serif italic. */
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Key/value facts shown in a hairline table (device, IP, time…). */
  facts?: [string, string][];
  footnote?: string;
}

/**
 * The ArtCraft look in email-safe HTML: hairline frame, mono HUD labels,
 * serif-italic accent, square ink button. Table layout + inline styles so it
 * survives Gmail, Outlook and Apple Mail.
 */
export function layout(p: EmailParts): { html: string; text: string } {
  const [lead, accent] = p.title.split('|');
  const initial = esc(config.brandName.slice(0, 1).toUpperCase());
  const hud = (s: string, color = FAINT) =>
    `<span style="font-family:${MONO};font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:${color}">${esc(s)}</span>`;

  const facts = p.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0 0;border-top:1px solid ${LINE}">
        ${p.facts
          .map(
            ([k, v]) => `<tr>
              <td style="padding:10px 0;border-bottom:1px solid ${LINE};width:38%;vertical-align:top">${hud(k)}</td>
              <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:14px;color:${INK}">${esc(v)}</td>
            </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const action = p.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr>
        <td style="background:${INK}">
          <a href="${esc(p.action.url)}" style="display:inline-block;padding:15px 26px;font-family:${MONO};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#f2f1ee;text-decoration:none">${esc(p.action.label)} &rarr;</a>
        </td></tr></table>
       <p style="margin:18px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${FAINT}">Or paste this link into your browser:<br>
        <a href="${esc(p.action.url)}" style="font-family:${MONO};font-size:11px;color:${MUTED};word-break:break-all">${esc(p.action.url)}</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(lead)}${accent ? ' ' + esc(accent) : ''}</title></head>
<body style="margin:0;padding:0;background:${BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid ${LINE};background:${CARD}">
    <tr><td style="padding:16px 24px;border-bottom:1px solid ${LINE}">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:${INK};width:22px;height:22px;text-align:center;font-family:${MONO};font-size:12px;font-weight:700;color:#f2f1ee">${initial}</td>
        <td style="padding-left:10px;font-family:${SANS};font-size:14px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${INK}">${esc(config.brandName)}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px 24px 36px">
      ${hud(p.eyebrow)}
      <h1 style="margin:14px 0 0;font-family:${SANS};font-size:30px;line-height:1.1;font-weight:600;letter-spacing:-.03em;color:${INK}">${esc(lead.trim())}${
        accent ? ` <span style="font-family:${SERIF};font-style:italic;font-weight:400;color:${MUTED}">${esc(accent.trim())}</span>` : ''
      }</h1>
      ${p.paragraphs.map((t) => `<p style="margin:16px 0 0;font-family:${SANS};font-size:15px;line-height:1.65;color:${MUTED}">${esc(t)}</p>`).join('')}
      ${facts}
      ${action}
    </td></tr>
    <tr><td style="padding:14px 24px;border-top:1px solid ${LINE}">
      ${hud(p.footnote ?? `Sent by ${config.brandName} · ${new URL(config.publicUrl).host}`)}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    p.eyebrow.toUpperCase(),
    '',
    `${lead.trim()}${accent ? ' ' + accent.trim() : ''}`,
    '',
    ...p.paragraphs.flatMap((t) => [t, '']),
    ...(p.facts ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(p.action ? ['', `${p.action.label}: ${p.action.url}`] : []),
    '',
    '—',
    p.footnote ?? `Sent by ${config.brandName}`,
  ].join('\n');

  return { html, text };
}
