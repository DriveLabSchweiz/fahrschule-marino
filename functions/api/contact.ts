interface ContactRequest {
  name: string;
  phone: string;
  email: string;
  service?: string;
  message?: string;
  'cf-turnstile-response': string;
}

const TURNSTILE_SECRET = 'YOUR_TURNSTILE_SECRET_KEY';
const EMAIL_TO = 'Antoniomarino@gmx.ch';
const EMAIL_FROM = 'formular@fahrschule-marino.ch';

export const onRequestPost: PagesFunction = async (context) => {
  // CORS
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://fahrschule-marino.ch',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data: ContactRequest = await context.request.json();

    // Validate required fields
    if (!data.name || !data.phone || !data.email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify Turnstile token
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: data['cf-turnstile-response'],
        remoteip: context.request.headers.get('CF-Connecting-IP') || '',
      }),
    });

    const turnstileResult = await turnstileResponse.json();

    if (!turnstileResult.success) {
      return new Response(JSON.stringify({ error: 'Spam verification failed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format email
    const serviceLabel: Record<string, string> = {
      fahrstunden: 'Fahrstunden',
      vku: 'Verkehrskundeunterricht (VKU)',
      nothelferkurs: 'Nothelferkurs',
      pruefungsvorbereitung: 'Prüfungsvorbereitung',
      kontrollfahrt: 'Kontrollfahrt',
      motorradgrundkurs: 'Motorradgrundkurs',
      sonstiges: 'Sonstiges',
    };

    const emailBody = `
Neue Anfrage über fahrschule-marino.ch

Name: ${data.name}
Telefon: ${data.phone}
E-Mail: ${data.email}
Gewünschte Leistung: ${data.service ? serviceLabel[data.service] || data.service : 'Nicht angegeben'}

Nachricht:
${data.message || 'Keine Nachricht'}
`;

    // Send email via Cloudflare Email Workers (or Mailgun, or SMTP relay)
    // For now, log it — integrate with your email provider of choice
    console.log('Contact form submission:', emailBody);

    // TODO: Integrate with email provider
    // Options: Cloudflare Email Routing, Mailgun, Resend, SendGrid
    // Example with Resend:
    // await fetch('https://api.resend.com/emails', { ... })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
