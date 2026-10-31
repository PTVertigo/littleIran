import { screen } from '@testing-library/react';

import { mockFetch, renderApp } from '../test/render';

const script = "<script>alert('xss')</script>";
const user = {
  id: '1',
  email: 'xss@example.com',
  firstName: script,
  lastName: '<img src=x onerror=alert(1)>',
  role: 'user',
  createdAt: '2026-10-01T00:00:00.000Z',
};

// UT-004 (REQ-4.1.3)
describe('Showing user-supplied text', () => {
  it('displays a script tag in a name as plain text instead of running it', async () => {
    mockFetch({ status: 200, body: { user } });
    renderApp('/dashboard');

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(`Welcome, ${script}`);
    expect(document.body.querySelector('script')).toBeNull();
    expect(heading.querySelector('*')).toBeNull();
  });
});
