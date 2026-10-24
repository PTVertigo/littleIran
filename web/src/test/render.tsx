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
