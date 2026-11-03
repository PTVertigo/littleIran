import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { businessPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const categories = { status: 200, body: { categories: [{ id: '1', name: 'Restaurant' }, { id: '2', name: 'Retail' }] } };

// Cafe 01 ... Cafe 25 as the server would send them, 10 to a page
const cafes = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  name: `Cafe ${String(i + 1).padStart(2, '0')}`,
  category: 'Restaurant',
  city: 'Hamilton',
  description: 'Tea.',
}));
const pageOf = (page: number, total = 25) => ({
  status: 200,
  body: businessPage(cafes.slice((page - 1) * 10, page * 10).slice(0, Math.max(0, total - (page - 1) * 10)), { page, total }),
});

const nav = () => screen.getByRole('navigation', { name: 'Business pages' });
const pageButton = (n: number) => within(nav()).getByRole('button', { name: `Page ${n}` });
const names = () => screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent);

// REQ-3.7.7
describe('Business directory pagination', () => {
  it('shows the first 10 businesses with page navigation when there are more than 10', async () => {
    mockFetch(signedOut, categories, pageOf(1));
    renderApp('/businesses');

    await screen.findAllByRole('article');
    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe('Cafe 01');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–10 of 25 businesses. Page 1 of 3.');
    expect(within(nav()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Previous', '1', '2', '3', 'Next']);
  });

  it('marks the current page, for a screen reader as well as by colour', async () => {
    mockFetch(signedOut, categories, pageOf(1));
    renderApp('/businesses');

    await screen.findAllByRole('article');
    expect(pageButton(1)).toHaveAttribute('aria-current', 'page');
    expect(pageButton(2)).not.toHaveAttribute('aria-current');
  });

  it('has no page navigation when everything fits on one page', async () => {
    mockFetch(signedOut, categories, { status: 200, body: businessPage(cafes.slice(0, 10)) });
    renderApp('/businesses');

    await screen.findAllByRole('article');
    expect(screen.queryByRole('navigation', { name: 'Business pages' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('10 businesses');
  });

  it('asks the server for the page that was chosen and shows it', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(1), pageOf(2));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    expect(await screen.findByText('Cafe 11')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?page=2');
    expect(names()[0]).toBe('Cafe 11');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 11–20 of 25 businesses. Page 2 of 3.');
    expect(pageButton(2)).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the page in the address, so it can be shared and the back button works', async () => {
    mockFetch(signedOut, categories, pageOf(1), pageOf(2), pageOf(1));
    const router = renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));
    await screen.findByText('Cafe 11');
    expect(router.state.location.search).toBe('?page=2');

    await router.navigate(-1);
    expect(await screen.findByText('Cafe 01')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('opens straight on the page in the address', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(3));
    renderApp('/businesses?page=3');

    expect(await screen.findByText('Cafe 21')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/businesses?page=3');
    expect(names()).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 21–25 of 25 businesses. Page 3 of 3.');
  });

  it('moves with Next and Previous', async () => {
    mockFetch(signedOut, categories, pageOf(1), pageOf(2), pageOf(1));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(within(nav()).getByRole('button', { name: 'Next' }));
    await screen.findByText('Cafe 11');
    await userEvent.click(within(nav()).getByRole('button', { name: 'Previous' }));

    expect(await screen.findByText('Cafe 01')).toBeInTheDocument();
  });

  it('does nothing when Previous is used on the first page or Next on the last', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(3));
    renderApp('/businesses?page=3');
    await screen.findByText('Cafe 21');

    const next = within(nav()).getByRole('button', { name: 'Next' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(next);
    await userEvent.click(pageButton(3));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(within(nav()).getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('moves keyboard focus to the results line after a page change, and the next Tab reaches the first business', async () => {
    mockFetch(signedOut, categories, pageOf(1), pageOf(2));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    pageButton(2).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByText('Cafe 11');

    expect(screen.getByRole('status')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Cafe 11' })).toHaveFocus();
  });

  it('keeps the old page on screen, marked busy, while the next one loads', async () => {
    let finish: (value: object) => void = () => {};
    const fetchMock = mockFetch(signedOut, categories, pageOf(1));
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    expect(screen.getByText('Cafe 01')).toBeInTheDocument();
    expect(document.querySelector('.card-grid')).toHaveAttribute('aria-busy', 'true');
    finish({ ok: true, status: 200, json: async () => pageOf(2).body });
    expect(await screen.findByText('Cafe 11')).toBeInTheDocument();
    expect(document.querySelector('.card-grid')).toHaveAttribute('aria-busy', 'false');
  });

  it('starts again from the first page when the search changes', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(2), { status: 200, body: businessPage(cafes.slice(0, 3)) });
    const router = renderApp('/businesses?page=2');
    await screen.findByText('Cafe 11');

    await userEvent.type(screen.getByLabelText('Search businesses'), 'cafe{Enter}');

    await screen.findByText('Cafe 03');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=cafe');
    expect(router.state.location.search).toBe('?search=cafe');
  });

  it('starts again from the first page when a category is chosen', async () => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(2), { status: 200, body: businessPage(cafes.slice(0, 3)) });
    const router = renderApp('/businesses?page=2');
    await screen.findByText('Cafe 11');

    await userEvent.click(await screen.findByRole('button', { name: 'Restaurant' }));

    await screen.findByText('Cafe 03');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?category=Restaurant');
    expect(router.state.location.search).toBe('?category=Restaurant');
  });

  it('keeps the search and the category when the page changes', async () => {
    const filtered = (page: number) => ({ status: 200, body: businessPage(cafes.slice((page - 1) * 10, page * 10), { page, total: 25 }) });
    const fetchMock = mockFetch(signedOut, categories, filtered(1), filtered(2));
    const router = renderApp('/businesses?search=cafe&category=Restaurant');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    await screen.findByText('Cafe 11');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=cafe&category=Restaurant&page=2');
    expect(router.state.location.search).toBe('?search=cafe&category=Restaurant&page=2');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 11–20 of 25 businesses found for “cafe” in Restaurant. Page 2 of 3.');
  });

  it('takes the page back to the first when it goes back to page 1', async () => {
    mockFetch(signedOut, categories, pageOf(2), pageOf(1));
    const router = renderApp('/businesses?page=2');
    await screen.findByText('Cafe 11');

    await userEvent.click(pageButton(1));

    await screen.findByText('Cafe 01');
    expect(router.state.location.search).toBe('');
  });

  it.each(['0', '-1', 'abc', '2.5', '99999999'])('treats the page %p in the address as the first page', async (value) => {
    const fetchMock = mockFetch(signedOut, categories, pageOf(1));
    renderApp(`/businesses?page=${value}`);

    expect(await screen.findByText('Cafe 01')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/businesses');
  });

  it('explains a page past the end and offers the way back to the first page', async () => {
    mockFetch(signedOut, categories, { status: 200, body: businessPage([], { page: 9, total: 25 }) }, pageOf(1));
    renderApp('/businesses?page=9');

    expect(await screen.findByText('There is no page 9. The results have 3 pages.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to the first page' }));

    expect(await screen.findByText('Cafe 01')).toBeInTheDocument();
  });

  it('explains any failure in plain words', async () => {
    mockFetch(signedOut, categories, pageOf(1), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(pageButton(2));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});

// A long run of pages shows the ends and the neighbours of the current page, with gaps between
describe('Business directory page numbers for many pages', () => {
  const many = (page: number) => ({ status: 200, body: businessPage(cafes.slice(0, 10), { page, total: 200 }) });

  it.each([
    [1, ['Previous', '1', '2', '20', 'Next']],
    [2, ['Previous', '1', '2', '3', '20', 'Next']],
    [10, ['Previous', '1', '9', '10', '11', '20', 'Next']],
    [19, ['Previous', '1', '18', '19', '20', 'Next']],
    [20, ['Previous', '1', '19', '20', 'Next']],
  ])('on page %p shows %p', async (page, labels) => {
    mockFetch(signedOut, categories, many(page));
    renderApp(`/businesses?page=${page}`);

    await screen.findAllByRole('article');
    expect(within(nav()).getAllByRole('button').map((b) => b.textContent)).toEqual(labels);
    expect(pageButton(page)).toHaveAttribute('aria-current', 'page');
  });
});
