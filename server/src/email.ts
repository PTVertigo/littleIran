import { createHash, createHmac } from 'node:crypto';

const API_VERSION = '2023-03-31';
const SEND_TIMEOUT_MS = 10_000;

// ACS_CONNECTION_STRING looks like `endpoint=https://x.communication.azure.com/;accesskey=...`.
// The key is base64, so it can end in `=`: split each part on its first `=` only.
function parseConnectionString(value: string) {
  const parts = Object.fromEntries(
    value
      .split(';')
      .filter((part) => part.includes('='))
      .map((part) => [part.slice(0, part.indexOf('=')).toLowerCase(), part.slice(part.indexOf('=') + 1)]),
  );
  if (!parts.endpoint || !parts.accesskey) {
    throw new Error('ACS_CONNECTION_STRING needs an endpoint and an accesskey');
  }
  return { endpoint: new URL(parts.endpoint), accessKey: parts.accesskey };
}

// Azure Communication Services Email over HTTPS, because Render's free tier blocks SMTP ports.
// Requests are signed with HMAC-SHA256 over the verb, path, date, host and body hash.
async function sendWithAzure(to: string, resetLink: string) {
  const { endpoint, accessKey } = parseConnectionString(process.env.ACS_CONNECTION_STRING!);
  const sender = process.env.EMAIL_FROM;
  if (!sender) throw new Error('EMAIL_FROM is not set');

  const pathAndQuery = `/emails:send?api-version=${API_VERSION}`;
  const body = JSON.stringify({
    senderAddress: sender,
    recipients: { to: [{ address: to }] },
    content: {
      subject: 'Reset your LittleIran password',
      plainText:
        `Someone asked to reset the password for your LittleIran account.\n\n` +
        `Choose a new password: ${resetLink}\n\n` +
        `The link works for one hour. If you did not ask for this, ignore this email.`,
      html:
        `<p>Someone asked to reset the password for your LittleIran account.</p>` +
        `<p><a href="${resetLink}">Choose a new password</a></p>` +
        `<p>The link works for one hour. If you did not ask for this, ignore this email.</p>`,
    },
  });

  const date = new Date().toUTCString();
  const contentHash = createHash('sha256').update(body).digest('base64');
  const signature = createHmac('sha256', Buffer.from(accessKey, 'base64'))
    .update(`POST\n${pathAndQuery}\n${date};${endpoint.host};${contentHash}`)
    .digest('base64');

  const res = await fetch(`${endpoint.origin}${pathAndQuery}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ms-date': date,
      'x-ms-content-sha256': contentHash,
      Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Azure email send failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}

// REQ-3.1.6 delivery. With no provider configured the link is printed in development, and never
// in production, where it would leak a working reset token.
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  if (process.env.ACS_CONNECTION_STRING) {
    await sendWithAzure(to, resetLink);
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No email provider configured');
  }
  console.log(`Password reset for ${to}: ${resetLink}`);
}
