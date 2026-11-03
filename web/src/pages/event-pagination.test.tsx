import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { eventPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const categories = { status: 200, body: { categories: [{ id: '1', name: 'Festival' }, { id: '2', name: 'Cultural Events' }] } };

// Event 01 ... Event 25 as the server would send them, 10 to a page
const events = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  title: `Event ${String(i + 1).padStart(2, '0')}`,
  category: 'Festival',
  startsAt: '2026-12-12T16:00:00.000Z',
  location: 'Hamilton',
  description: 'Music.',
  past: false,
}));
const pageOf = (page: number, total = 25) => ({
  status: 200,
  body: eventPage(events.slice((page - 1) * 10, page * 10).slice(0, Math.max(0, total - (page - 1) * 10)), { page, total }),
});

const nav = () => screen.getByRole('navigation', { name: 'Event pages' });
const pageButton = (n: number) => within(nav()).getByRole('button', { name: `Page ${n}` });
const names = () => screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent);

// REQ-3.7.8 / FE-004
describe('Events pagination', () => {
  it('shows the first 10 events with page navigation when there are more than 10', async () => {
    mockFetch(signedOut, categories, pageOf(1));
    renderApp('/events');

    await screen.findAllByRole('article');
    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe('Event 01');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–10 of 25 events. Page 1 of 3.');
    expect(within(nav()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Previous', '1', '2', '3', 'Next']);
  });

  it('marks the current page, for a screen reader as well as by colour', async () => {
    mockFetch(signedOut, categories, pageOf(1));
    renderApp('/events');

    await screen.findAllByRole('article');
    expect(pageButton(1)).toHaveAttribute('aria-current', 'page');
    expect(pageButton(2)).not.toHaveAttribute('aria-current');
  });

  it('has no page navigation when everything fits on one page', async () => {
    mockFetch(signedOut, categories, { status: 200, body: eventPage(events.slice(0, 10)) });
    renderApp('/events');

    await screen.findAllByRole('article');
    expect(screen.queryByRole('navigation', { name: 'Event pages' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('10 events');
  });

  it('asks the server for the page that was chosen and shows it', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(1), pageOf(2));
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    expect(await screen.findByText('Event 11')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?page=2');
    expect(names()[0]).toBe('Event 11');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 11–20 of 25 events. Page 2 of 3.');
    expect(pageButton(2)).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the page in the address, so it can be shared and the back button works', async () => {
    mockFetch(signedOut, categories, pageOf(1), pageOf(2), pageOf(1));
    const router = renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));
    await screen.findByText('Event 11');
    expect(router.state.location.search).toBe('?page=2');

    await router.navigate(-1);
    expect(await screen.findByText('Event 01')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('opens straight on the page in the address', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(3));
    renderApp('/events?page=3');

    expect(await screen.findByText('Event 21')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/events?page=3');
    expect(names()).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 21–25 of 25 events. Page 3 of 3.');
  });

  it('moves with Next and Previous', async () => {
    mockFetch(signedOut, categories, pageOf(1), pageOf(2), pageOf(1));
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(within(nav()).getByRole('button', { name: 'Next' }));
    await screen.findByText('Event 11');
    await userEvent.click(within(nav()).getByRole('button', { name: 'Previous' }));

    expect(await screen.findByText('Event 01')).toBeInTheDocument();
  });

  it('does nothing when Next is used on the last page', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(3));
    renderApp('/events?page=3');
    await screen.findByText('Event 21');

    const next = within(nav()).getByRole('button', { name: 'Next' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(next);
    await userEvent.click(pageButton(3));

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('moves keyboard focus to the results line after a page change, and the next Tab reaches the first event', async () => {
    mockFetch(signedOut, categories, pageOf(1), pageOf(2));
    renderApp('/events');
    await screen.findAllByRole('article');

    pageButton(2).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByText('Event 11');

    expect(screen.getByRole('status')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Event 11' })).toHaveFocus();
  });

  it('keeps the old page on screen, marked busy, while the next one loads', async () => {
    let finish: (value: object) => void = () => {};
    const fetchMock = mockFetch(signedOut, categories, pageOf(1));
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    expect(screen.getByText('Event 01')).toBeInTheDocument();
    expect(document.querySelector('.card-grid')).toHaveAttribute('aria-busy', 'true');
    finish({ ok: true, status: 200, json: async () => pageOf(2).body });
    expect(await screen.findByText('Event 11')).toBeInTheDocument();
    expect(document.querySelector('.card-grid')).toHaveAttribute('aria-busy', 'false');
  });

  // FE-004: Cultural Events category with pagination
  it('pages through a category: the page request keeps the category, and the count is for the category', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(1), pageOf(1), pageOf(2));
    const router = renderApp('/events');
    await screen.findAllByRole('article');
    await userEvent.click(within(screen.getByRole('group', { name: 'Filter by category' })).getByRole('button', { name: 'Cultural Events' }));
    await screen.findByText(/Showing 1–10 of 25 events in Cultural Events/);

    await userEvent.click(pageButton(2));

    await screen.findByText('Event 11');
    expect(fetchMock.mock.calls[4][0]).toBe('/api/events?category=Cultural+Events&page=2');
    expect(router.state.location.search).toBe('?category=Cultural+Events&page=2');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 11–20 of 25 events in Cultural Events. Page 2 of 3.');
  });

  it('keeps the search and the category when the page changes', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(1), pageOf(2));
    const router = renderApp('/events?search=event&category=Festival');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    await screen.findByText('Event 11');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=event&category=Festival&page=2');
    expect(router.state.location.search).toBe('?search=event&category=Festival&page=2');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 11–20 of 25 events found for “event” in Festival. Page 2 of 3.');
  });

  it('starts again from the first page when the search changes', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(2), { status: 200, body: eventPage(events.slice(0, 3)) });
    const router = renderApp('/events?page=2');
    await screen.findByText('Event 11');

    await userEvent.type(screen.getByLabelText('Search events'), 'event{Enter}');

    await screen.findByText('Event 03');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=event');
    expect(router.state.location.search).toBe('?search=event');
  });

  it('starts again from the first page when a category is chosen', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(2), { status: 200, body: eventPage(events.slice(0, 3)) });
    const router = renderApp('/events?page=2');
    await screen.findByText('Event 11');

    await userEvent.click(await screen.findByRole('button', { name: 'Festival' }));

    await screen.findByText('Event 03');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?category=Festival');
    expect(router.state.location.search).toBe('?category=Festival');
  });

  it('takes the page back to the first when it goes back to page 1', async () => {
    mockFetch(signedOut, categories, pageOf(2), pageOf(1));
    const router = renderApp('/events?page=2');
    await screen.findByText('Event 11');

    await userEvent.click(pageButton(1));

    await screen.findByText('Event 01');
    expect(router.state.location.search).toBe('');
  });

  it.each(['0', '-1', 'abc', '2.5', '99999999'])('treats the page %p in the address as the first page', async (value) => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(1));
    renderApp(`/events?page=${value}`);

    expect(await screen.findByText('Event 01')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/events');
  });

  it('explains a page past the end and offers the way back to the first page', async () => {
    mockFetch(signedOut, categories, { status: 200, body: eventPage([], { page: 9, total: 25 }) }, pageOf(1));
    renderApp('/events?page=9');

    expect(await screen.findByText('There is no page 9. The results have 3 pages.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to the first page' }));

    expect(await screen.findByText('Event 01')).toBeInTheDocument();
  });

  it('explains any failure in plain words', async () => {
    mockFetch(signedOut, categories, pageOf(1), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});
