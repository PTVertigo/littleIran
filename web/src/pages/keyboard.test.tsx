import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

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
});
