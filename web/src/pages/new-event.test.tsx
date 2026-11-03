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
  body: { categories: [{ id: '7', name: 'Festival' }, { id: '8', name: 'Workshop' }, { id: '12', name: 'Cultural Events' }] },
};
const created = { status: 201, body: { event: { id: '30', title: 'Yalda Night', status: 'pending' } } };

async function openForm(...after: { status: number; body?: object }[]) {
  const fetchMock = mockFetch(signedIn, categories, ...after);
  renderApp('/events/new');
  await screen.findByRole('heading', { level: 1, name: 'Add an event' });
  await screen.findByLabelText('Event name');
  return fetchMock;
}

const field = (label: string | RegExp) => screen.getByLabelText(label);
const type = (label: string | RegExp, text: string) => userEvent.type(field(label), text);
// Date and time inputs take their value as one change, not key by key
const setValue = (label: string | RegExp, value: string) => fireEvent.change(field(label), { target: { value } });
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));

async function fillEverything() {
  await type('Event name', 'Yalda Night');
  await userEvent.selectOptions(field('Category'), 'Cultural Events');
  await type('Description', 'Poetry and pomegranates.');
  await type('Location', 'Mississauga Banquet Hall');
  setValue('Date', '2027-12-21');
  setValue('Start time', '19:30');
  setValue(/End time/, '22:00');
  await type('Organizer name', 'Peel Persian Community');
  await type('Organizer contact', 'info@peel.example.com');
}

// REQ-3.4 create an event
describe('Add an event page', () => {
  it('sends a visitor who is not logged in to the login page', async () => {
    mockFetch(signedOut);
    const router = renderApp('/events/new');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('asks for the event details, with the event categories from the server', async () => {
    const fetchMock = await openForm();

    for (const label of ['Event name', 'Category', 'Description', 'Location', 'Date', 'Start time', /End time/, 'Organizer name', 'Organizer contact']) {
      expect(field(label)).toBeInTheDocument();
    }
    expect(fetchMock.mock.calls[1][0]).toBe('/api/categories?type=event');
    expect(within(field('Category')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose a category', 'Festival', 'Workshop', 'Cultural Events',
    ]);
  });

  it('uses date and time inputs, so a phone shows its own pickers', async () => {
    await openForm();

    expect(field('Date')).toHaveAttribute('type', 'date');
    expect(field('Start time')).toHaveAttribute('type', 'time');
    expect(field(/End time/)).toHaveAttribute('type', 'time');
  });

  it('says the times are Ontario time, and that the end is optional', async () => {
    await openForm();

    expect(field('Start time')).toHaveAccessibleDescription('Ontario time.');
    expect(screen.getByText('End time (optional)')).toBeInTheDocument();
  });

  it('asks for every required field, without sending anything, when it is empty', async () => {
    const fetchMock = await openForm();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the fields marked below and try again.');
    expect(field('Event name')).toHaveAccessibleDescription('Enter the event name.');
    expect(field('Category')).toHaveAccessibleDescription('Choose a category.');
    expect(field('Description')).toHaveAccessibleDescription(/Describe the event\./);
    expect(field('Location')).toHaveAccessibleDescription(/Enter where the event is held\./);
    expect(field('Date')).toHaveAccessibleDescription(/Enter the date of the event\./);
    expect(field('Start time')).toHaveAccessibleDescription(/Enter the time the event starts\./);
    expect(field('Organizer name')).toHaveAccessibleDescription("Enter the organizer's name.");
    expect(field('Organizer contact')).toHaveAccessibleDescription(/Enter an email address or phone number for the organizer\./);
    expect(field(/End time/)).not.toHaveAttribute('aria-invalid');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('names the problem when the event ends before it starts', async () => {
    const fetchMock = await openForm();
    await fillEverything();

    setValue(/End time/, '18:00');
    await submit();

    expect(field(/End time/)).toHaveAccessibleDescription(/The event must end after it starts\./);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('submits the event and says it is waiting for approval', async () => {
    const fetchMock = await openForm(created);
    await fillEverything();

    await submit();

    expect(await screen.findByRole('heading', { level: 1, name: 'Event submitted' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Yalda Night has been submitted');
    expect(screen.getByRole('status')).toHaveTextContent('once it is approved');
    const [path, init] = fetchMock.mock.calls[2];
    expect(path).toBe('/api/events');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      title: 'Yalda Night',
      categoryId: '12',
      description: 'Poetry and pomegranates.',
      location: 'Mississauga Banquet Hall',
      date: '2027-12-21',
      startTime: '19:30',
      endTime: '22:00',
      organizerName: 'Peel Persian Community',
      organizerContact: 'info@peel.example.com',
    });
  });

  it('sends an empty end time when none was given, and trims what was typed', async () => {
    const fetchMock = await openForm(created);
    await fillEverything();
    await userEvent.clear(field('Event name'));
    await type('Event name', '   Yalda Night   ');
    setValue(/End time/, '');

    await submit();

    await screen.findByRole('heading', { name: 'Event submitted' });
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.title).toBe('Yalda Night');
    expect(body.endTime).toBe('');
  });

  it("shows the server's complaint about the date next to its field and keeps what was typed", async () => {
    await openForm({ status: 400, body: { errors: { date: 'Choose a date and time that have not passed yet, within the next three years.' } } });
    await fillEverything();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the fields marked below and try again.');
    expect(field('Date')).toHaveAccessibleDescription(/have not passed yet/);
    expect(field('Event name')).toHaveValue('Yalda Night');
    expect(screen.queryByRole('heading', { name: 'Event submitted' })).not.toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains any other failure in plain words', async () => {
    await openForm({ status: 500, body: { error: 'Something went wrong. Please try again.' } });
    await fillEverything();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(field('Event name')).toHaveValue('Yalda Night');
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

  it('lets the member add another event afterwards, starting from an empty form', async () => {
    await openForm(created);
    await fillEverything();
    await submit();
    await screen.findByRole('heading', { name: 'Event submitted' });

    await userEvent.click(screen.getByRole('button', { name: 'Add another event' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Add an event' })).toBeInTheDocument();
    expect(field('Event name')).toHaveValue('');
    expect(field('Date')).toHaveValue('');
  });

  // REQ-4.4.4
  it('shows a loading indicator until the categories arrive', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => signedIn.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/events/new');

    expect(await screen.findByText('Loading the form')).toBeInTheDocument();
    expect(screen.queryByLabelText('Event name')).not.toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => categories.body });
    expect(await screen.findByLabelText('Event name')).toBeInTheDocument();
  });

  it('says so, instead of showing a form it cannot complete, when the categories fail to load', async () => {
    mockFetch(signedIn, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/events/new');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.queryByLabelText('Event name')).not.toBeInTheDocument();
  });

  it('can be completed with the keyboard alone', async () => {
    const fetchMock = await openForm(created);
    await fillEverything();

    field('Event name').focus();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Event submitted' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("is reached from the events page's \"Add an event\" button", async () => {
    mockFetch(signedIn, categories, { status: 200, body: { events: [] } }, categories);
    renderApp('/events');

    await userEvent.click(await screen.findByRole('link', { name: 'Add an event' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Add an event' })).toBeInTheDocument();
  });
});

