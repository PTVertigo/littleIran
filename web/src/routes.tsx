import type { RouteObject } from 'react-router';

import { Layout } from './components/layout';
import { GuestOnly, RequireAuth } from './components/route-guards';
import { DashboardPage } from './pages/dashboard';
import { ErrorPage } from './pages/error';
import { HomePage } from './pages/home';
import { LoginPage } from './pages/login';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        // Errors render inside the layout, so the header and navigation stay usable
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { element: <GuestOnly />, children: [{ path: 'login', element: <LoginPage /> }] },
          { element: <RequireAuth />, children: [{ path: 'dashboard', element: <DashboardPage /> }] },
          { path: '*', element: <ErrorPage /> },
        ],
      },
    ],
  },
];
