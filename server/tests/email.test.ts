import { createHash, createHmac } from 'node:crypto';
import { sendPasswordResetEmail } from '../src/email';

const accessKey = Buffer.from('not-a-real-key').toString('base64');
const connectionString = `endpoint=https://littleiran-comm.unitedstates.communication.azure.com/;accesskey=${accessKey}`;
const link = 'https://littleiran.onrender.com/reset-password?token=abc123';

const original = { ...process.env };
let fetchMock: jest.SpyInstance;
let logMock: jest.SpyInstance;

beforeEach(() => {
  delete process.env.ACS_CONNECTION_STRING;
  delete process.env.EMAIL_FROM;
  fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
  logMock = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...original };
  jest.restoreAllMocks();
});

// REQ-3.1.6 delivery
describe('sendPasswordResetEmail', () => {
  it('prints the link in development when no provider is configured', async () => {
    process.env.NODE_ENV = 'development';

    await sendPasswordResetEmail('sara@example.com', link);

    expect(logMock).toHaveBeenCalledWith(expect.stringContaining(link));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to send in production without a provider, and never prints the link', async () => {
    process.env.NODE_ENV = 'production';

    await expect(sendPasswordResetEmail('sara@example.com', link)).rejects.toThrow('No email provider configured');
    expect(logMock).not.toHaveBeenCalled();
  });

  describe('with Azure Communication Services', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.ACS_CONNECTION_STRING = connectionString;
      process.env.EMAIL_FROM = 'DoNotReply@example.azurecomm.net';
    });

    it('posts the reset link to the recipient from the configured sender', async () => {
      await sendPasswordResetEmail('sara@example.com', link);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://littleiran-comm.unitedstates.communication.azure.com/emails:send?api-version=2023-03-31');
      const body = JSON.parse(init.body);
      expect(body.senderAddress).toBe('DoNotReply@example.azurecomm.net');
      expect(body.recipients.to).toEqual([{ address: 'sara@example.com' }]);
      expect(body.content.plainText).toContain(link);
      expect(body.content.html).toContain(`href="${link}"`);
      expect(logMock).not.toHaveBeenCalled();
    });

    it('signs the request the way Azure expects', async () => {
      await sendPasswordResetEmail('sara@example.com', link);

      const [, init] = fetchMock.mock.calls[0];
      const { 'x-ms-date': date, 'x-ms-content-sha256': hash, Authorization } = init.headers;
      expect(hash).toBe(createHash('sha256').update(init.body).digest('base64'));
      const host = 'littleiran-comm.unitedstates.communication.azure.com';
      const expected = createHmac('sha256', Buffer.from(accessKey, 'base64'))
        .update(`POST\n/emails:send?api-version=2023-03-31\n${date};${host};${hash}`)
        .digest('base64');
      expect(Authorization).toBe(`HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${expected}`);
    });

    it('fails without leaking the access key when Azure rejects the request', async () => {
      fetchMock.mockResolvedValue(new Response('{"error":{"code":"Unauthorized"}}', { status: 401 }));

      const error = await sendPasswordResetEmail('sara@example.com', link).catch((err: Error) => err);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('401');
      expect((error as Error).message).not.toContain(accessKey);
    });

    it('fails when the sender address is not configured', async () => {
      delete process.env.EMAIL_FROM;

      await expect(sendPasswordResetEmail('sara@example.com', link)).rejects.toThrow('EMAIL_FROM');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails on a connection string without an access key', async () => {
      process.env.ACS_CONNECTION_STRING = 'endpoint=https://x.communication.azure.com/';

      await expect(sendPasswordResetEmail('sara@example.com', link)).rejects.toThrow('accesskey');
    });
  });
});
