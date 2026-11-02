import type { RouteObject } from 'react-router';

import { Layout } from './components/layout';
import { GuestOnly, RequireAuth } from './components/route-guards';
import { BusinessDetailPage } from './pages/business-detail';
import { BusinessesPage } from './pages/businesses';
import { ChangePasswordPage } from './pages/change-password';
import { DashboardPage } from './pages/dashboard';
import { EditProfilePage } from './pages/edit-profile';
import { ErrorPage } from './pages/error';
import { ForgotPasswordPage } from './pages/forgot-password';
import { HomePage } from './pages/home';
import { LoginPage } from './pages/login';
import { NewBusinessPage } from './pages/new-business';
import { ProfilePage } from './pages/profile';
import { PublicProfilePage } from './pages/public-profile';
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
          // Approved listings are public, so no login is needed to browse them
          { path: 'businesses', element: <BusinessesPage /> },
          { path: 'businesses/:id', element: <BusinessDetailPage /> },
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
              // Static, so it wins over businesses/:id; only a logged-in member can submit a listing
              { path: 'businesses/new', element: <NewBusinessPage /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'profile/edit', element: <EditProfilePage /> },
              { path: 'users/:id', element: <PublicProfilePage /> },
              { path: 'change-password', element: <ChangePasswordPage /> },
            ],
          },
          { path: '*', element: <ErrorPage /> },
        ],
      },
    ],
  },
];
