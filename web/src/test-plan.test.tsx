// The browser-side test cases named in the Milestone 4 document's test plan (section 5), one test per case,
// using the document's own input and checking its expected output. Every title starts with the document's
// ID, so a single case can be run by itself:
//   npm run test:plan:web -- -t "UT-003"
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { validateBusinessForm, type BusinessForm } from './lib/business-validation';
import { isStrongPassword, isValidEmail } from './lib/validation';
import { mockFetch, renderApp } from './test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };

describe('Unit tests (browser side)', () => {
  // F1.2 · input: valid `test@domain.com`, invalid `test@invalid` · expected: true / false
  it('UT-002 email format checker: test@domain.com is valid and test@invalid is not', () => {
    expect(isValidEmail('test@domain.com')).toBe(true);
    expect(isValidEmail('test@invalid')).toBe(false);
  });

  // F1.3 · input: `weak`, `Strong1!`, `Strong1@` · expected: only `Strong1!` and `Strong1@` pass
  it('UT-003 password strength: only Strong1! and Strong1@ pass, weak does not', () => {
    expect(isStrongPassword('weak')).toBe(false);
    expect(isStrongPassword('Strong1!')).toBe(true);
    expect(isStrongPassword('Strong1@')).toBe(true);
  });

  // NF 4.1.3 · input: `<script>alert('xss')</script>` · expected: script tags escaped or removed
  it("UT-004 XSS: <script>alert('xss')</script> in a name is shown as plain text and never runs", async () => {
    const script = "<script>alert('xss')</script>";
    mockFetch({
      status: 200,
      body: { user: { id: '1', email: 'x@example.com', firstName: script, lastName: 'Tester', role: 'user', status: 'active', createdAt: '2026-10-01T00:00:00.000Z' } },
    });
    renderApp('/dashboard');

    const heading = await screen.findByRole('heading', { level: 1 });

    expect(heading).toHaveTextContent(`Welcome, ${script}`);
    expect(document.body.querySelector('script')).toBeNull();
    expect(heading.querySelector('*')).toBeNull();
  });

  // F3.1, F3.2 · input: business object with missing required fields · expected: validation errors
  it('UT-005 business listing validation: a form with missing required fields returns validation errors', () => {
    const form: BusinessForm = {
      name: 'Darband Restaurant',
      categoryId: '',
      description: '',
      street: '',
      city: '',
      postalCode: '',
      phone: '',
      email: '',
      website: '',
      hours: Array.from({ length: 7 }, () => ({ open: false, opens: '09:00', closes: '17:00' })),
    };

    const errors = validateBusinessForm(form);

    expect(Object.keys(errors).sort()).toEqual(['categoryId', 'city', 'description', 'email', 'hours', 'phone', 'postalCode', 'street']);
  });
});

describe('Accessibility tests (browser side)', () => {
  // NF 4.3.2 · navigate using Tab and Enter only · expected: all functionality reachable without a mouse
  it('ACC-003 keyboard navigation: Tab reaches every control of the login page in order, and Enter submits it', async () => {
    const fetchMock = mockFetch(signedOut, { status: 401, body: { error: 'Invalid credentials' } });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });

    for (const name of [
      'Skip to main content', 'LittleIran', 'Home', 'Businesses', 'Events', 'Forum', 'Log in', 'Sign up',
      'Email', 'Password', 'Show password', 'Log in', 'Forgot your password?', 'Create an account',
    ]) {
      await userEvent.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }

    screen.getByLabelText('Email').focus();
    await userEvent.keyboard('test@test.com');
    await userEvent.tab();
    await userEvent.keyboard('Wrong123@{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // NF 4.3.3 · scan for proper heading hierarchy and landmarks · expected: semantic HTML for screen readers
  it.each(['/', '/login', '/register', '/businesses', '/events', '/no-such-page'])(
    'ACC-004 semantic HTML: %s has the page landmarks and exactly one level-1 heading',
    async (path) => {
      mockFetch(signedOut, { status: 200, body: { categories: [] } }, { status: 200, body: { businesses: [], events: [], page: 1, pageSize: 10, total: 0, totalPages: 1 } });
      renderApp(path);

      await screen.findAllByRole('heading', { level: 1 });

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    },
  );

  it('ACC-004 semantic HTML: headings never skip a level on the business directory', async () => {
    const business = { id: '1', name: 'Cafe', category: 'Restaurant', city: 'Hamilton', description: 'Tea.' };
    mockFetch(
      signedOut,
      { status: 200, body: { categories: [{ id: '1', name: 'Restaurant' }] } },
      { status: 200, body: { businesses: [business], page: 1, pageSize: 10, total: 1, totalPages: 1 } },
    );
    renderApp('/businesses');
    await screen.findAllByRole('article');

    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));

    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
    expect(levels[0]).toBe(1);
  });
});
