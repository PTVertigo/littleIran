import { screen } from '@testing-library/react';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };

// ACC-004 (REQ-4.3.3)
describe('Layout', () => {
  it('gives every page the same landmarks and a skip link', async () => {
    mockFetch(signedOut);
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'LittleIran' })).toBeVisible();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  // REQ-4.4.4
  it('shows a loading indicator while it checks for a session', async () => {
    global.fetch = jest.fn(() => new Promise<Response>(() => {}));
    renderApp('/');

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  // REQ-4.2.1
  it('shows a plain not-found page inside the layout for an unknown address', async () => {
    mockFetch(signedOut);
    renderApp('/no-such-page');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });
});
