import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { businessPage, eventPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };

// ACC-003 (REQ-4.3.2) everything can be reached and used with the keyboard alone
describe('Keyboard navigation', () => {
  it('walks through the login page in a sensible order', async () => {
    mockFetch(signedOut);
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });

    const order = [
      'Skip to main content',
      'LittleIran',
      'Home',
      'Businesses',
      'Events',
      'Forum',
      'Log in',
      'Sign up',
      'Email',
      'Password',
      'Show password',
      'Log in',
      'Forgot your password?',
      'Create an account',
    ];
    for (const name of order) {
      await userEvent.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }
  });

  it('logs in without touching the mouse', async () => {
    mockFetch(signedOut, { status: 401, body: { error: 'Invalid credentials' } });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });

    screen.getByLabelText('Email').focus();
    await userEvent.keyboard('test@test.com');
    await userEvent.tab();
    await userEvent.keyboard('Wrong123@{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('shows a visible focus target on the skip link', async () => {
    mockFetch(signedOut);
    renderApp('/');
    await screen.findByRole('heading', { name: 'LittleIran' });

    await userEvent.tab();

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  // REQ-4.3.2: the lists with search, filter and page navigation are all reachable in reading order
  it('walks through the events page in a sensible order', async () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      id: String(i + 1), title: `Event ${i + 1}`, category: 'Festival', startsAt: '2026-12-12T16:00:00.000Z', location: 'Hamilton', description: 'Music.', past: false,
    }));
    mockFetch(
      signedOut,
      { status: 200, body: { categories: [{ id: '1', name: 'Festival' }] } },
      { status: 200, body: eventPage(events.slice(0, 10), { total: 12 }) },
    );
    renderApp('/events');
    await screen.findAllByRole('article');

    const order = [
      'Skip to main content', 'LittleIran', 'Home', 'Businesses', 'Events', 'Forum', 'Log in', 'Sign up',
      'Add an event', 'Search events', 'Search', 'All', 'Festival',
      'Event 1', 'Event 2', 'Event 3', 'Event 4', 'Event 5', 'Event 6', 'Event 7', 'Event 8', 'Event 9', 'Event 10',
      'Previous', 'Page 1', 'Page 2', 'Next',
    ];
    for (const name of order) {
      await userEvent.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }
  });

  it('walks through the business directory in a sensible order', async () => {
    const businesses = [1, 2].map((i) => ({ id: String(i), name: `Cafe ${i}`, category: 'Restaurant', city: 'Hamilton', description: 'Tea.' }));
    mockFetch(
      signedOut,
      { status: 200, body: { categories: [{ id: '1', name: 'Restaurant' }] } },
      { status: 200, body: businessPage(businesses) },
    );
    renderApp('/businesses');
    await screen.findAllByRole('article');

    const order = [
      'Skip to main content', 'LittleIran', 'Home', 'Businesses', 'Events', 'Forum', 'Log in', 'Sign up',
      'Add a business', 'Search businesses', 'Search', 'All', 'Restaurant', 'Cafe 1', 'Cafe 2',
    ];
    for (const name of order) {
      await userEvent.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }
  });
});
