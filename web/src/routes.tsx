import type { RouteObject } from 'react-router';

import { Layout } from './components/layout';
import { ErrorPage } from './pages/error';
import { HomePage } from './pages/home';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        // Errors render inside the layout, so the header and navigation stay usable
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: '*', element: <ErrorPage /> },
        ],
      },
    ],
  },
];
