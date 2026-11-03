import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const signedIn = {
  status: 200,
  body: {
    user: { id: '1', email: 'sara@example.com', firstName: 'Sara', lastName: 'Ahmadi', role: 'user', status: 'active', createdAt: '2026-10-01T12:00:00.000Z' },
  },
};
const categories = {
  status: 200,
  body: {
    categories: [
      { id: '1', name: 'Restaurant' },
      { id: '2', name: 'Retail' },
      { id: '3', name: 'Services' },
    ],
  },
};
const created = { status: 201, body: { business: { id: '16', name: 'Darband Restaurant', status: 'pending' } } };

async function openForm(...after: { status: number; body?: object }[]) {
  const fetchMock = mockFetch(signedIn, categories, ...after);
  renderApp('/businesses/new');
  await screen.findByRole('heading', { level: 1, name: 'Add a business' });
  await screen.findByLabelText('Business name');
  return fetchMock;
}

const field = (label: string | RegExp) => screen.getByLabelText(label);
const type = (label: string | RegExp, text: string) => userEvent.type(field(label), text);
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));

async function fillEverything() {
  await type('Business name', 'Darband Restaurant');
  await userEvent.selectOptions(field('Category'), 'Restaurant');
  await type('Description', 'Mountain-style Persian dining.');
  await type('Street address', '45 Example Road');
  await type('City', 'Mississauga');
  await type('Postal code', 'L5B 1B2');
  await type('Phone number', '905-555-0102');
  await type('Business email', 'info@darband.example.com');
  await type(/Website/, 'https://example.com/darband');
  await userEvent.click(field('Monday is open'));
  fireEvent.change(field('Monday opens'), { target: { value: '12:00' } });
  fireEvent.change(field('Monday closes'), { target: { value: '23:00' } });
  await userEvent.click(field('Saturday is open'));
}

// REQ-3.3 / FE
describe('Add a business page', () => {
  it('sends a visitor who is not logged in to the login page', async () => {
    mockFetch(signedOut);
    const router = renderApp('/businesses/new');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('asks for the business details, with the categories from the server', async () => {
    const fetchMock = await openForm();

    for (const label of ['Business name', 'Category', 'Description', 'Street address', 'City', 'Postal code', 'Phone number', 'Business email', /Website/]) {
      expect(field(label)).toBeInTheDocument();
    }
    expect(fetchMock.mock.calls[1][0]).toBe('/api/categories?type=business');
    const options = within(field('Category')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose a category', 'Restaurant', 'Retail', 'Services']);
  });

  it('lists all seven days in the hours section, none open to start with', async () => {
    await openForm();

    const hours = screen.getByRole('group', { name: 'Opening hours' });
    expect(within(hours).getAllByRole('checkbox')).toHaveLength(7);
    for (const box of within(hours).getAllByRole('checkbox')) expect(box).not.toBeChecked();
    expect(field('Monday opens')).toBeDisabled();
    expect(field('Monday closes')).toBeDisabled();
  });

  it('opens the times of a day when it is ticked, starting at 9:00 to 17:00', async () => {
    await openForm();

    await userEvent.click(field('Tuesday is open'));

    expect(field('Tuesday opens')).toBeEnabled();
    expect(field('Tuesday opens')).toHaveValue('09:00');
    expect(field('Tuesday closes')).toHaveValue('17:00');
    expect(field('Wednesday opens')).toBeDisabled();
  });

  it('asks for every required field, without sending anything, when it is empty', async () => {
    const fetchMock = await openForm();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the fields marked below and try again.');
    expect(field('Business name')).toHaveAccessibleDescription('Enter the business name.');
    expect(field('Category')).toHaveAccessibleDescription('Choose a category.');
    expect(field('Description')).toHaveAccessibleDescription(/Describe the business\./);
    expect(field('Street address')).toHaveAccessibleDescription('Enter the street address.');
    expect(field('City')).toHaveAccessibleDescription('Enter the city.');
    expect(field('Postal code')).toHaveAccessibleDescription(/Enter the postal code\./);
    expect(field('Phone number')).toHaveAccessibleDescription(/Enter the phone number\./);
    expect(field('Business email')).toHaveAccessibleDescription('Enter the business email address.');
    expect(screen.getByRole('group', { name: 'Opening hours' })).toHaveAccessibleDescription('Enter the opening and closing time for at least one day.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('flags a bad postal code, phone number, email and website next to each field', async () => {
    const fetchMock = await openForm();
    await fillEverything();

    await userEvent.clear(field('Postal code'));
    await type('Postal code', '90210');
    await userEvent.clear(field('Phone number'));
    await type('Phone number', '555-0102');
    await userEvent.clear(field('Business email'));
    await type('Business email', 'info@darband');
    await userEvent.clear(field(/Website/));
    await type(/Website/, 'javascript:alert(1)');
    await submit();

    expect(field('Postal code')).toHaveAccessibleDescription(/Enter a postal code like L8P 1A1\./);
    expect(field('Phone number')).toHaveAccessibleDescription(/Enter a 10-digit phone number/);
    expect(field('Business email')).toHaveAccessibleDescription('Enter a valid email address.');
    expect(field(/Website/)).toHaveAccessibleDescription(/Enter a web address that starts with http:\/\/ or https:\/\//);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('names the day that closes before it opens', async () => {
    const fetchMock = await openForm();
    await fillEverything();

    fireEvent.change(field('Monday closes'), { target: { value: '08:00' } });
    await submit();

    expect(screen.getByRole('group', { name: 'Opening hours' })).toHaveAccessibleDescription('Monday must close after it opens.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('submits the listing, with the open days as numbered hours, and says it is waiting for approval', async () => {
    const fetchMock = await openForm(created);
    await fillEverything();

    await submit();

    expect(await screen.findByRole('heading', { level: 1, name: 'Business submitted' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Darband Restaurant has been submitted');
    expect(screen.getByRole('status')).toHaveTextContent('once it is approved');
    const [path, init] = fetchMock.mock.calls[2];
    expect(path).toBe('/api/businesses');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Darband Restaurant',
      categoryId: '1',
      description: 'Mountain-style Persian dining.',
      street: '45 Example Road',
      city: 'Mississauga',
      postalCode: 'L5B 1B2',
      phone: '905-555-0102',
      email: 'info@darband.example.com',
      website: 'https://example.com/darband',
      hours: [
        { day: 1, opens: '12:00', closes: '23:00' },
        { day: 6, opens: '09:00', closes: '17:00' },
      ],
    });
  });

  it('trims what was typed before sending it, and sends an empty website as empty', async () => {
    const fetchMock = await openForm(created);
    await fillEverything();
    await userEvent.clear(field('Business name'));
    await type('Business name', '   Darband Restaurant   ');
    await userEvent.clear(field(/Website/));

    await submit();

    await screen.findByRole('heading', { name: 'Business submitted' });
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.name).toBe('Darband Restaurant');
    expect(body.website).toBe('');
  });

  it('shows the server\'s complaint next to its field and keeps what was typed', async () => {
    await openForm({ status: 400, body: { errors: { postalCode: 'Enter a postal code like L8P 1A1.' } } });
    await fillEverything();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the fields marked below and try again.');
    expect(field('Postal code')).toHaveAccessibleDescription(/Enter a postal code like L8P 1A1\./);
    expect(field('Business name')).toHaveValue('Darband Restaurant');
    expect(screen.queryByRole('heading', { name: 'Business submitted' })).not.toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains any other failure in plain words', async () => {
    await openForm({ status: 500, body: { error: 'Something went wrong. Please try again.' } });
    await fillEverything();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(field('Business name')).toHaveValue('Darband Restaurant');
  });

  it('cannot be submitted twice while it is saving', async () => {
    const fetchMock = await openForm();
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    await fillEverything();

    await submit();

    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Submitting…' }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('lets the member add another business afterwards, starting from an empty form', async () => {
    await openForm(created);
    await fillEverything();
    await submit();
    await screen.findByRole('heading', { name: 'Business submitted' });

    await userEvent.click(screen.getByRole('button', { name: 'Add another business' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Add a business' })).toBeInTheDocument();
    expect(field('Business name')).toHaveValue('');
    expect(field('Monday is open')).not.toBeChecked();
  });

  // REQ-4.4.4
  it('shows a loading indicator until the categories arrive', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => signedIn.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/businesses/new');

    expect(await screen.findByText('Loading the form')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => categories.body });
    expect(await screen.findByLabelText('Business name')).toBeInTheDocument();
  });

  it('says so, instead of showing a form it cannot complete, when the categories fail to load', async () => {
    mockFetch(signedIn, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/businesses/new');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();
  });

  it('can be completed with the keyboard alone', async () => {
    const fetchMock = await openForm(created);
    await fillEverything();

    field('Business name').focus();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Business submitted' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('is reached from the directory\'s "Add a business" button', async () => {
    mockFetch(signedIn, categories, { status: 200, body: { businesses: [] } }, categories);
    renderApp('/businesses');

    await userEvent.click(await screen.findByRole('link', { name: 'Add a business' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Add a business' })).toBeInTheDocument();
  });
});
