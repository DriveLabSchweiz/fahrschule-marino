/**
 * Contact Form Handler — Cloudflare Pages Function
 *
 * Empfängt Formular-Daten vom Kontaktformular,
 * verifiziert Cloudflare Turnstile,
 * und sendet E-Mail via Resend API.
 *
 * Environment Variables (in Cloudflare Pages Dashboard setzen):
 * - TURNSTILE_SECRET_KEY: Cloudflare Turnstile Secret
 * - RESEND_API_KEY: Resend API Key
 * - EMAIL_TO: Empfangsadresse (default: Antoniomarino@gmx.ch)
 * - EMAIL_FROM: Absenderadresse (default: formular@fahrschule-marino.ch)
 */

interface ContactRequest {
  name: string;
  phone: string;
  email: string;
  service?: string;
  message?: string;
  'cf-turnstile-response': string;
}

interface Env {
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  EMAIL_TO?: string;
  EMAIL_FROM?: string;
}

const DEFAULT_EMAIL_TO = 'Antoniomarino@gmx.ch';
const DEFAULT_EMAIL_FROM = 'formular@fahrschule-marino.ch';

const SERVICE_LABELS: Record<string, string> = {
  fahrstunden: 'Fahrstunden',
  vku: 'Verkehrskundeunterricht (VKU)',
  nothelferkurs: 'Nothelferkurs',
  pruefungsvorbereitung: 'Prüfungsvorbereitung',
  kontrollfahrt: 'Kontrollfahrt',
  motorradgrundkurs: 'Motorradgrundkurs',
  sonstiges: 'Sonstiges',
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // CORS — nur eigene Domain erlauben
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'https://fahrschule-marino.ch',
    'https://www.fahrschule-marino.ch',
    'http://localhost:4321',
    'http://localhost:4322',
  ];

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (context.request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const data: ContactRequest = await request.json();

    // --- Validierung ---
    if (!data.name?.trim() || !data.phone?.trim() || !data.email?.trim()) {
      return jsonResponse({ error: 'Bitte fülle alle Pflichtfelder aus (Name, Telefon, E-Mail).' }, 400);
    }

    // E-Mail-Format prüfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return jsonResponse({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, 400);
    }

    // --- Turnstile verifizieren ---
    if (!env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY.startsWith('YOUR_')) {
      // Im Dev-Modus ohne konfigurierten Key überspringen
      console.warn('[contact] TURNSTILE_SECRET_KEY not configured — skipping verification (dev mode)');
    } else {
      const turnstileResult = await verifyTurnstile(
        data['cf-turnstile-response'],
        env.TURNSTILE_SECRET_KEY,
        request.headers.get('CF-Connecting-IP') || ''
      );

      if (!turnstileResult.success) {
        return jsonResponse({ error: 'Spam-Verifizierung fehlgeschlagen. Bitte versuche es erneut.' }, 403);
      }
    }

    // --- E-Mail senden ---
    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.startsWith('YOUR_')) {
      console.warn('[contact] RESEND_API_KEY not configured — logging only');
      console.log('[contact] Form submission:', formatEmailBody(data));
      return jsonResponse({
        success: true,
        message: 'Anfrage empfangen (DEV — E-Mail nicht gesendet).',
      });
    }

    const emailTo = env.EMAIL_TO || DEFAULT_EMAIL_TO;
    const emailFrom = env.EMAIL_FROM || DEFAULT_EMAIL_FROM;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Fahrschule Marino <${emailFrom}>`,
        to: [emailTo],
        reply_to: `${data.name} <${data.email}>`,
        subject: ` Neue Anfrage: ${data.service ? SERVICE_LABELS[data.service] || data.service : 'Allgemein'}`,
        text: formatEmailBody(data),
        html: formatEmailHTML(data),
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('[contact] Resend API error:', emailResponse.status, errorText);
      return jsonResponse({ error: 'E-Mail-Versand fehlgeschlagen. Bitte rufe an: 078 826 10 61' }, 502);
    }

    const result = await emailResponse.json();
    console.log('[contact] Email sent successfully:', result.id);

    return jsonResponse({
      success: true,
      message: 'Anfrage gesendet! Antonio meldet sich innerhalb von 24 Stunden bei dir.',
    });
  } catch (err) {
    console.error('[contact] Unexpected error:', err);
    return jsonResponse({ error: 'Ein unerwarteter Fehler ist aufgetreten. Bitte rufe an: 078 826 10 61' }, 500);
  }
};

// --- Helper Functions ---

async function verifyTurnstile(token: string, secret: string, remoteip: string) {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip,
    }),
  });
  return response.json();
}

function formatEmailBody(data: ContactRequest): string {
  return `
Neue Anfrage über fahrschule-marino.ch
=======================================

Name:      ${data.name}
Telefon:   ${data.phone}
E-Mail:    ${data.email}
Leistung:  ${data.service ? SERVICE_LABELS[data.service] || data.service : 'Nicht angegeben'}

Nachricht:
${data.message || 'Keine Nachricht'}
`;
}

function formatEmailHTML(data: ContactRequest): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0A0E17; border-radius: 16px; overflow: hidden; border: 1px solid #1A2138;">
    <div style="background: linear-gradient(135deg, #F5B614, #FFD23F); padding: 24px;">
      <h1 style="margin: 0; color: #0A0E17; font-size: 24px; font-weight: 800;">Neue Anfrage</h1>
      <p style="margin: 4px 0 0; color: #0A0E17; opacity: 0.8;">fahrschule-marino.ch</p>
    </div>
    <div style="padding: 32px 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #64748B; width: 100px; vertical-align: top;">Name</td><td style="padding: 8px 0; color: #F1F5F9; font-weight: 600;">${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748B; vertical-align: top;">Telefon</td><td style="padding: 8px 0;"><a href="tel:${escapeHtml(data.phone)}" style="color: #F5B614; text-decoration: none;">${escapeHtml(data.phone)}</a></td></tr>
        <tr><td style="padding: 8px 0; color: #64748B; vertical-align: top;">E-Mail</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(data.email)}" style="color: #F5B614; text-decoration: none;">${escapeHtml(data.email)}</a></td></tr>
        <tr><td style="padding: 8px 0; color: #64748B; vertical-align: top;">Leistung</td><td style="padding: 8px 0; color: #F1F5F9;">${data.service ? escapeHtml(SERVICE_LABELS[data.service] || data.service) : 'Nicht angegeben'}</td></tr>
      </table>
      ${data.message ? `
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #1A2138;">
        <p style="color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">Nachricht</p>
        <div style="background: #121826; border-radius: 12px; padding: 16px; color: #94A3B8; line-height: 1.6;">${escapeHtml(data.message)}</div>
      </div>
      ` : ''}
    </div>
  </div>
</div>
`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function jsonResponse(data: object, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
