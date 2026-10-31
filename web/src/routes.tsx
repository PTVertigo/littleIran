import type { RouteObject } from 'react-router';

import { Layout } from './components/layout';
import { GuestOnly, RequireAuth } from './components/route-guards';
import { ChangePasswordPage } from './pages/change-password';
import { DashboardPage } from './pages/dashboard';
import { ErrorPage } from './pages/error';
import { ForgotPasswordPage } from './pages/forgot-password';
import { HomePage } from './pages/home';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { ResetPasswordPage } from './pages/reset-password';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        // Errors render inside the layout, so the header and navigation stay usable
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <GuestOnly />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
              { path: 'forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
          // Open to anyone holding the emailed link, logged in or not
          { path: 'reset-password', element: <ResetPasswordPage /> },
          {
            element: <RequireAuth />,
            children: [
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'change-password', element: <ChangePasswordPage /> },
            ],
          },
          { path: '*', element: <ErrorPage /> },
        ],
      },
    ],
  },
];
