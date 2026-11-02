import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const business = {
  id: '8',
  name: 'Pars Rug Gallery',
  category: 'Retail',
  description: 'Hand-knotted rugs, with cleaning and repair on site.',
  street: '9 Example Road',
  city: 'Oakville',
  postalCode: 'L6H 5H8',
  phone: '905-555-0108',
  email: 'info@pars.example.com',
  website: 'https://example.com/pars',
  hours: [
    { day: 1, opens: '10:00', closes: '19:00' },
    { day: 2, opens: '10:00', closes: '19:00' },
    { day: 6, opens: '09:30', closes: '17:45' },
  ],
};
const found = (overrides: object = {}) => ({ status: 200, body: { business: { ...business, ...overrides } } });

async function openBusiness(overrides: object = {}) {
  const fetchMock = mockFetch(signedOut, found(overrides));
  renderApp('/businesses/8');
  await screen.findByRole('heading', { level: 1, name: overrides && 'name' in overrides ? String((overrides as { name: string }).name) : 'Pars Rug Gallery' });
  return fetchMock;
}

// The text next to a label such as "Phone"
const valueOf = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

// REQ-3.3.2
describe('Business detail page', () => {
  it('shows the name, category, city and description', async () => {
    const fetchMock = await openBusiness();

    expect(screen.getByText('Retail · Oakville')).toBeInTheDocument();
    expect(screen.getByText('Hand-knotted rugs, with cleaning and repair on site.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/businesses/8');
  });

  it('shows the address, phone, email and website', async () => {
    await openBusiness();

    expect(valueOf('Address')).toHaveTextContent('9 Example Road, Oakville L6H 5H8');
    expect(valueOf('Phone')).toHaveTextContent('905-555-0108');
    expect(valueOf('Email')).toHaveTextContent('info@pars.example.com');
    expect(valueOf('Website')).toHaveTextContent('https://example.com/pars');
  });

  it('makes the phone, email and website usable links', async () => {
    await openBusiness();

    expect(within(valueOf('Phone')).getByRole('link', { name: '905-555-0108' })).toHaveAttribute('href', 'tel:9055550108');
    expect(within(valueOf('Email')).getByRole('link')).toHaveAttribute('href', 'mailto:info@pars.example.com');
    const site = within(valueOf('Website')).getByRole('link');
    expect(site).toHaveAttribute('href', 'https://example.com/pars');
    expect(site).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('writes a phone number with spaces and brackets as a clean tel: link', async () => {
    await openBusiness({ phone: '(905) 555 0108' });

    const link = within(valueOf('Phone')).getByRole('link', { name: '(905) 555 0108' });
    expect(link).toHaveAttribute('href', 'tel:9055550108');
  });

  it('lists all seven days, with the hours of the days it is open and "Closed" for the rest', async () => {
    await openBusiness();

    const table = screen.getByRole('table', { name: 'Opening hours' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Monday10:00 AM – 7:00 PM',
      'Tuesday10:00 AM – 7:00 PM',
      'WednesdayClosed',
      'ThursdayClosed',
      'FridayClosed',
      'Saturday9:30 AM – 5:45 PM',
      'SundayClosed',
    ]);
    expect(within(rows[0]).getByRole('rowheader', { name: 'Monday' })).toBeInTheDocument();
  });

  it('says so, instead of listing seven closed days, when no hours were given', async () => {
    await openBusiness({ hours: [] });

    expect(screen.getByText('Opening hours have not been provided.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('leaves out the website row when there is no website', async () => {
    await openBusiness({ website: null });

    expect(screen.queryByText('Website', { selector: 'dt' })).not.toBeInTheDocument();
  });

  // REQ-4.1.3 a stored website is user text
  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'not a web address'])(
    'shows the website %p as plain text, never as a link',
    async (website) => {
      await openBusiness({ website });

      expect(valueOf('Website')).toHaveTextContent(website);
      expect(within(valueOf('Website')).queryByRole('link')).not.toBeInTheDocument();
    },
  );

  it('shows a name and description containing markup as plain text', async () => {
    await openBusiness({ name: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>' });

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
    expect(document.body.querySelector('img[onerror]')).toBeNull();
  });

  it('has a way back to the directory', async () => {
    await openBusiness();

    expect(screen.getByRole('link', { name: 'Back to the business directory' })).toHaveAttribute('href', '/businesses');
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, found());
    const router = renderApp('/businesses/8');

    await screen.findByRole('heading', { level: 1, name: 'Pars Rug Gallery' });
    expect(router.state.location.pathname).toBe('/businesses/8');
  });

  // REQ-4.4.4
  it('shows a loading indicator until the business arrives', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/businesses/8');

    expect(await screen.findByText('Loading the business')).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => ({ business }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Pars Rug Gallery' })).toBeInTheDocument();
    expect(screen.queryByText('Loading the business')).not.toBeInTheDocument();
  });

  it('says plainly when the business does not exist or is not published', async () => {
    mockFetch(signedOut, { status: 404, body: { error: 'Business not found.' } });
    renderApp('/businesses/999');

    expect(await screen.findByRole('heading', { level: 1, name: 'Business not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the business directory' })).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains any other failure in plain words', async () => {
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/businesses/8');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('is reached by clicking a business in the directory', async () => {
    mockFetch(
      signedOut,
      { status: 200, body: { businesses: [{ id: '8', name: 'Pars Rug Gallery', category: 'Retail', city: 'Oakville', description: 'Rugs.' }] } },
      found(),
    );
    renderApp('/businesses');

    await userEvent.click(await screen.findByRole('link', { name: 'Pars Rug Gallery' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Contact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pars Rug Gallery' })).toBeInTheDocument();
  });
});
