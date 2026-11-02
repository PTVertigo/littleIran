import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const signedIn = {
  status: 200,
  body: {
    user: {
      id: '1',
      email: 'sara@example.com',
      firstName: 'Sara',
      lastName: 'Ahmadi',
      role: 'user',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
    },
  },
};
const businesses = [
  { id: '1', name: 'Norouz Restaurant', category: 'Restaurant', city: 'Hamilton', description: 'Kebabs and stews.' },
  { id: '2', name: 'Pars Rug Gallery', category: 'Retail', city: 'Oakville', description: 'Hand-knotted rugs.' },
];

// REQ-3.3.1
describe('Business directory page', () => {
  it('lists each business with its name, category, city and description', async () => {
    const fetchMock = mockFetch(signedOut, { status: 200, body: { businesses } });
    renderApp('/businesses');

    expect(await screen.findByRole('heading', { level: 1, name: 'Business directory' })).toBeInTheDocument();
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('heading', { level: 2, name: 'Norouz Restaurant' })).toBeInTheDocument();
    // REQ-3.3.2 the name opens the business
    expect(within(cards[0]).getByRole('link', { name: 'Norouz Restaurant' })).toHaveAttribute('href', '/businesses/1');
    expect(within(cards[1]).getByRole('link', { name: 'Pars Rug Gallery' })).toHaveAttribute('href', '/businesses/2');
    expect(cards[0]).toHaveTextContent('Restaurant · Hamilton');
    expect(cards[0]).toHaveTextContent('Kebabs and stews.');
    expect(within(cards[1]).getByRole('heading', { level: 2, name: 'Pars Rug Gallery' })).toBeInTheDocument();
    expect(cards[1]).toHaveTextContent('Retail · Oakville');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/businesses');
  });

  it('shows how many businesses there are, in the right grammar', async () => {
    mockFetch(signedOut, { status: 200, body: { businesses } });
    renderApp('/businesses');
    expect(await screen.findByText('2 businesses')).toBeInTheDocument();
  });

  it('says "1 business" for a single listing', async () => {
    mockFetch(signedOut, { status: 200, body: { businesses: [businesses[0]] } });
    renderApp('/businesses');
    expect(await screen.findByText('1 business')).toBeInTheDocument();
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, { status: 200, body: { businesses } });
    const router = renderApp('/businesses');

    await screen.findAllByRole('article');
    expect(router.state.location.pathname).toBe('/businesses');
  });

  it('is open to a logged-in member too', async () => {
    mockFetch(signedIn, { status: 200, body: { businesses } });
    renderApp('/businesses');

    expect(await screen.findAllByRole('article')).toHaveLength(2);
  });

  // REQ-4.4.4
  it('shows a loading indicator until the businesses arrive', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/businesses');

    expect(await screen.findByText('Loading businesses')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => ({ businesses }) });
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(screen.queryByText('Loading businesses')).not.toBeInTheDocument();
  });

  it('says so plainly when there are no businesses yet', async () => {
    mockFetch(signedOut, { status: 200, body: { businesses: [] } });
    renderApp('/businesses');

    expect(await screen.findByText('No businesses have been listed yet.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/businesses');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  // REQ-4.1.3
  it('shows a name containing markup as plain text', async () => {
    const hostile = [{ ...businesses[0], name: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>' }];
    mockFetch(signedOut, { status: 200, body: { businesses: hostile } });
    renderApp('/businesses');

    await screen.findByRole('heading', { level: 2, name: '<script>alert(1)</script>' });
    expect(document.body.querySelector('script')).toBeNull();
    expect(document.body.querySelector('img[onerror]')).toBeNull();
  });

  // REQ-4.4.2 one click from the home page, and from the navigation on every page
  it('is one click away from the home page button', async () => {
    mockFetch(signedOut, { status: 200, body: { businesses } });
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'Browse businesses' }));

    expect(await screen.findByRole('heading', { name: 'Business directory' })).toBeInTheDocument();
  });

  it('is one click away from the navigation, whether or not you are logged in', async () => {
    mockFetch(signedIn, { status: 200, body: { businesses } });
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: /Welcome/ });

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Businesses' }));

    expect(await screen.findByRole('heading', { name: 'Business directory' })).toBeInTheDocument();
  });
});
