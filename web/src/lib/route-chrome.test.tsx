import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';
import { titleFor } from './route-chrome';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const filterCategories = { status: 200, body: { categories: [{ id: '1', name: 'Festival' }] } };
const eventsPage = { status: 200, body: { events: [], page: 1, pageSize: 10, total: 0, totalPages: 1 } };

describe('titleFor', () => {
  it('puts the page heading before the site name', () => {
    expect(titleFor('Cultural events')).toBe('Cultural events – LittleIran');
  });

  it('uses just the site name for the home page, or when there is no heading yet', () => {
    expect(titleFor('LittleIran')).toBe('LittleIran');
    expect(titleFor('')).toBe('LittleIran');
    expect(titleFor('   ')).toBe('LittleIran');
  });

  it('trims the heading', () => {
    expect(titleFor('  Log in \n')).toBe('Log in – LittleIran');
  });
});

// REQ-4.3.3 / WCAG 2.4.2 and 2.4.3
describe('Page titles and focus', () => {
  it('gives each page a title made from its heading', async () => {
    mockFetch(signedOut);
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(document.title).toBe('Log in – LittleIran');
  });

  it('uses the site name alone for the home page', async () => {
    mockFetch(signedOut);
    renderApp('/');

    await screen.findByRole('heading', { name: 'LittleIran' });
    expect(document.title).toBe('LittleIran');
  });

  it('picks up a heading that appears after the page has loaded its content', async () => {
    mockFetch(signedOut, { status: 200, body: { event: { id: '4', title: 'Norouz Festival', category: 'Festival', description: 'x', location: 'y', startsAt: '2026-12-12T16:00:00.000Z', endsAt: null, organizerName: 'z', organizerContact: 'z', past: false } } });
    renderApp('/events/4');

    await screen.findByRole('heading', { level: 1, name: 'Norouz Festival' });
    expect(document.title).toBe('Norouz Festival – LittleIran');
  });

  it('changes the title when the page changes', async () => {
    mockFetch(signedOut, filterCategories, eventsPage);
    renderApp('/events');
    await screen.findByRole('heading', { level: 1, name: 'Cultural events' });
    expect(document.title).toBe('Cultural events – LittleIran');

    await userEvent.click(screen.getByRole('link', { name: 'Home' }));

    await screen.findByRole('heading', { level: 1, name: 'LittleIran' });
    expect(document.title).toBe('LittleIran');
  });

  it('moves focus to the main content when the page changes', async () => {
    mockFetch(signedOut, filterCategories, eventsPage);
    renderApp('/events');
    await screen.findByRole('heading', { level: 1, name: 'Cultural events' });

    await userEvent.click(screen.getByRole('link', { name: 'Home' }));

    await screen.findByRole('heading', { level: 1, name: 'LittleIran' });
    expect(document.getElementById('main')).toHaveFocus();
  });

  it('does not take focus from the page that was just loaded', async () => {
    mockFetch(signedOut);
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(document.getElementById('main')).not.toHaveFocus();
  });

  it('does not move focus when only the search, filter or page in the address changes', async () => {
    mockFetch(signedOut, filterCategories, eventsPage, eventsPage);
    renderApp('/events');
    await screen.findByRole('heading', { level: 1, name: 'Cultural events' });
    const box = screen.getByRole('searchbox', { name: 'Search events' });

    box.focus();
    await userEvent.keyboard('film{Enter}');

    await screen.findByText(/No events match/);
    expect(box).toHaveFocus();
  });
});
