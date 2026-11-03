// Needs the API and web app running (npm run dev) and the sample data from `cd server && npm run seed:listings`.
// Registers a throwaway user for each test, so the seeded account is never touched. The events it
// submits stay pending, so they never show up on the events page.

const daysAhead = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// The input behind a visible label; ids from React contain colons, so match by attribute
function field(label: string) {
  return cy.contains('label', label).then(($label) => cy.get(`[id="${$label.attr('for')}"]`));
}

function registerAndOpenForm() {
  const email = `cypress-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  cy.visit('/register');
  cy.get('input[autocomplete="given-name"]').type('Form');
  cy.get('input[autocomplete="family-name"]').type('Tester');
  cy.get('input[type="email"]').type(email);
  cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
  cy.location('pathname').should('eq', '/dashboard');

  cy.visit('/events');
  cy.contains('a', 'Add an event').click();
  cy.location('pathname').should('eq', '/events/new');
  cy.contains('h1', 'Add an event');
  cy.get('select').should('be.visible');
}

function fillEverything(title: string) {
  field('Event name').type(title);
  cy.get('select').select('Cultural Events');
  field('Description').type('Poetry and music for the winter solstice.');
  field('Location').type('Mississauga Banquet Hall, 45 Example Road, Mississauga');
  field('Date').type(daysAhead(30));
  field('Start time').type('19:30');
  field('End time').type('22:00');
  field('Organizer name').type('Peel Persian Community');
  field('Organizer contact').type('info@peel.example.com');
}

describe('Add an event', () => {
  it('sends a logged-out visitor to log in first', () => {
    cy.visit('/events/new');

    cy.location('pathname').should('eq', '/login');
  });

  it('is reached from the events page\'s "Add an event" button, with the event categories', () => {
    registerAndOpenForm();

    cy.get('select option').should('have.length', 7);
    cy.get('select option').then(($options) => {
      expect([...$options].map((o) => o.textContent)).to.deep.equal([
        'Choose a category', 'Festival', 'Workshop', 'Celebration', 'Educational', 'Social Gathering', 'Cultural Events',
      ]);
    });
  });

  it('asks for the missing fields, field by field, without submitting', () => {
    registerAndOpenForm();

    cy.contains('button', 'Submit for review').click();

    cy.get('[role="alert"]').should('contain', 'Check the fields marked below');
    cy.contains('.field__error', 'Enter the event name.');
    cy.contains('.field__error', 'Choose a category.');
    cy.contains('.field__error', 'Enter the date of the event.');
    cy.contains('.field__error', 'Enter the time the event starts.');
    cy.contains('h1', 'Add an event');
  });

  it('submits a complete event and says it is waiting for approval', () => {
    registerAndOpenForm();
    const title = `Cypress Night ${Date.now()}`;

    fillEverything(title);
    cy.contains('button', 'Submit for review').click();

    cy.contains('h1', 'Event submitted');
    cy.get('[role="status"]').should('contain', title).and('contain', 'once it is approved');
  });

  it('accepts an event with no end time', () => {
    registerAndOpenForm();
    fillEverything(`Cypress Night ${Date.now()}`);
    field('End time').clear();

    cy.contains('button', 'Submit for review').click();

    cy.contains('h1', 'Event submitted');
  });

  it('keeps a pending event off the events page, and counts it on the member\'s public profile', () => {
    registerAndOpenForm();
    const title = `Pending Night ${Date.now()}`;
    fillEverything(title);
    cy.contains('button', 'Submit for review').click();
    cy.contains('h1', 'Event submitted');

    cy.contains('a', 'Back to the events').click();
    cy.get('article').should('have.length', 10);
    cy.contains('article h2', title).should('not.exist');

    cy.get('nav[aria-label="Main"]').contains('a', 'Profile').click();
    cy.contains('a', 'See how other members see your profile').click();
    cy.contains('dt', 'Submissions').next('dd').should('have.text', '1');
  });

  it('names the problem when the event ends before it starts', () => {
    registerAndOpenForm();
    fillEverything(`Cypress Night ${Date.now()}`);
    field('End time').clear().type('18:00');

    cy.contains('button', 'Submit for review').click();

    cy.contains('.field__error', 'The event must end after it starts.');
    cy.contains('h1', 'Add an event');
  });

  it('refuses a date that has already passed, with the server\'s message next to the date', () => {
    registerAndOpenForm();
    fillEverything(`Cypress Night ${Date.now()}`);
    field('Date').clear().type(daysAhead(-5));

    cy.contains('button', 'Submit for review').click();

    cy.contains('.field__error', 'have not passed yet');
    cy.contains('h1', 'Add an event');
    field('Event name').should('not.have.value', '');
  });

  it('lets the member add another event afterwards', () => {
    registerAndOpenForm();
    fillEverything(`Cypress Night ${Date.now()}`);
    cy.contains('button', 'Submit for review').click();
    cy.contains('h1', 'Event submitted');

    cy.contains('button', 'Add another event').click();

    cy.contains('h1', 'Add an event');
    field('Event name').should('have.value', '');
  });
});
