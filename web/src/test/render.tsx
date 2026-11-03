import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { SessionProvider } from '../lib/session';
import { routes } from '../routes';

// Renders the real app at a given address, the way a browser would open it
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return router;
}

// Answers fetch calls in order with the given status and JSON body
export function mockFetch(...responses: { status: number; body?: object }[]) {
  const fetchMock = jest.fn();
  for (const { status, body } of responses) {
    fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
  }
  global.fetch = fetchMock;
  return fetchMock;
}

// The body of GET /api/businesses: one page of listings, with the paging details the server adds
export function businessPage(businesses: object[], paging: { page?: number; total?: number; totalPages?: number } = {}) {
  const total = paging.total ?? businesses.length;
  return { businesses, page: paging.page ?? 1, pageSize: 10, total, totalPages: paging.totalPages ?? Math.max(1, Math.ceil(total / 10)) };
}
