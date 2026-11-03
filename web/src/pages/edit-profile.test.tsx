import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const user = {
  id: '1',
  email: 'sara@example.com',
  firstName: 'Sara',
  lastName: 'Ahmadi',
  role: 'user',
  createdAt: '2026-10-01T12:00:00.000Z',
};
const session = { status: 200, body: { user } };

async function openEditor() {
  const fetchMock = mockFetch(session);
  renderApp('/profile/edit');
  await screen.findByRole('heading', { name: 'Edit profile' });
  return fetchMock;
}

const firstName = () => screen.getByLabelText('First name');
const lastName = () => screen.getByLabelText('Last name');
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

// REQ-3.2.2
describe('Edit profile page', () => {
  it('starts with the current names filled in', async () => {
    await openEditor();

    expect(firstName()).toHaveValue('Sara');
    expect(lastName()).toHaveValue('Ahmadi');
  });

  it('saves the new names, trimmed, with a PUT to the profile', async () => {
    const fetchMock = await openEditor();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: { ...user, firstName: 'Sarah', lastName: 'Rad' } }),
    });

    await userEvent.clear(firstName());
    await userEvent.type(firstName(), '  Sarah ');
    await userEvent.clear(lastName());
    await userEvent.type(lastName(), 'Rad');
    await save();

    expect(await screen.findByRole('status')).toHaveTextContent('Your profile has been updated.');
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/users/me');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ firstName: 'Sarah', lastName: 'Rad' });
    expect(firstName()).toHaveValue('Sarah');
  });

  it('shows the new name across the app straight away', async () => {
    const fetchMock = await openEditor();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: { ...user, firstName: 'Sarah' } }),
    });

    await userEvent.clear(firstName());
    await userEvent.type(firstName(), 'Sarah');
    await save();
    await screen.findByRole('status');
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Dashboard' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Sarah' })).toBeInTheDocument();
  });

  it('asks for both names without sending anything when one is blank', async () => {
    const fetchMock = await openEditor();

    await userEvent.clear(firstName());
    await userEvent.type(lastName(), '{Control>}a{/Control}{Backspace}   ');
    await save();

    expect(firstName()).toHaveAccessibleDescription('Enter your first name.');
    expect(lastName()).toHaveAccessibleDescription('Enter your last name.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the server\'s complaint next to the field it is about', async () => {
    const fetchMock = await openEditor();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ errors: { firstName: 'Enter your first name.' } }),
    });

    await save();

    expect(await screen.findByText('Enter your first name.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains a failure in plain words and keeps what was typed', async () => {
    const fetchMock = await openEditor();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something went wrong. Please try again.' }),
    });

    await userEvent.clear(firstName());
    await userEvent.type(firstName(), 'Sarah');
    await save();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(firstName()).toHaveValue('Sarah');
  });

  it('cannot be submitted twice while it is saving', async () => {
    const fetchMock = await openEditor();
    fetchMock.mockReturnValueOnce(new Promise(() => {}));

    await save();

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can be completed with the keyboard alone', async () => {
    const fetchMock = await openEditor();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: { ...user, lastName: 'Rad' } }),
    });

    lastName().focus();
    await userEvent.keyboard('{Control>}a{/Control}Rad{Enter}');

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ firstName: 'Sara', lastName: 'Rad' });
  });

  it('is reached from the profile page', async () => {
    mockFetch(session, { status: 200, body: { user } });
    renderApp('/profile');

    await userEvent.click(await screen.findByRole('link', { name: 'Edit profile' }));

    expect(await screen.findByRole('heading', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to profile' })).toHaveAttribute('href', '/profile');
  });

  it('sends a visitor who is not logged in to the login page', async () => {
    mockFetch({ status: 401, body: { error: 'Please log in to continue.' } });
    const router = renderApp('/profile/edit');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });
});
