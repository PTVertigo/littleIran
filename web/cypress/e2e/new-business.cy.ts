// Needs the API and web app running (npm run dev) and the sample businesses from `cd server && npm run seed:listings`.
// Registers a throwaway user for each test, so the seeded account is never touched. The listings it
// submits stay pending, so they never show up in the directory.

function registerAndOpenForm() {
  const email = `cypress-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  cy.visit('/register');
  cy.get('input[autocomplete="given-name"]').type('Form');
  cy.get('input[autocomplete="family-name"]').type('Tester');
  cy.get('input[type="email"]').type(email);
  cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
  cy.location('pathname').should('eq', '/dashboard');

  cy.visit('/businesses');
  cy.contains('a', 'Add a business').click();
  cy.location('pathname').should('eq', '/businesses/new');
  cy.contains('h1', 'Add a business');
  cy.get('select').should('be.visible');
}

// The visually hidden label names a time input ("Monday opens"); ids from React contain colons, so match by attribute
function timeInput(label: string) {
  return cy.contains('label.visually-hidden', label).then(($label) => cy.get(`[id="${$label.attr('for')}"]`));
}

function fillEverything(name: string) {
  cy.get('input[autocomplete="organization"]').type(name);
  cy.get('select').select('Restaurant');
  cy.get('textarea').type('Mountain-style Persian dining.');
  cy.get('input[autocomplete="street-address"]').type('45 Example Road');
  cy.get('input[autocomplete="address-level2"]').type('Mississauga');
  cy.get('input[autocomplete="postal-code"]').type('l5b 1b2');
  cy.get('input[autocomplete="tel"]').type('(905) 555 0102');
  cy.get('input[autocomplete="email"]').type('info@darband.example.com');
  cy.get('input[type="url"]').type('https://example.com/darband');
  cy.contains('label.hours-row__day', 'Monday').find('input').check();
  timeInput('Monday opens').type('12:00');
  timeInput('Monday closes').type('23:00');
  cy.contains('label.hours-row__day', 'Saturday').find('input').check();
}

describe('Add a business', () => {
  // REQ-3.3 / API-003
  it('sends a logged-out visitor to log in first', () => {
    cy.visit('/businesses/new');

    cy.location('pathname').should('eq', '/login');
  });

  it('is reached from the directory\'s "Add a business" button', () => {
    registerAndOpenForm();

    cy.get('fieldset.hours-field input[type="checkbox"]').should('have.length', 7);
    cy.get('select option').should('have.length', 7);
  });

  it('asks for the missing fields, field by field, without submitting', () => {
    registerAndOpenForm();

    cy.contains('button', 'Submit for review').click();

    cy.get('[role="alert"]').should('contain', 'Check the fields marked below');
    cy.contains('.field__error', 'Enter the business name.');
    cy.contains('.field__error', 'Choose a category.');
    cy.contains('.field__error', 'Enter the opening and closing time for at least one day.');
    cy.contains('h1', 'Add a business');
  });

  it('submits a complete listing and says it is waiting for approval', () => {
    registerAndOpenForm();
    const name = `Cypress Cafe ${Date.now()}`;

    fillEverything(name);
    cy.contains('button', 'Submit for review').click();

    cy.contains('h1', 'Business submitted');
    cy.get('[role="status"]').should('contain', name).and('contain', 'once it is approved');
  });

  it('keeps a pending listing out of the directory, and counts it on the member\'s public profile', () => {
    registerAndOpenForm();
    const name = `Pending Cafe ${Date.now()}`;
    fillEverything(name);
    cy.contains('button', 'Submit for review').click();
    cy.contains('h1', 'Business submitted');

    cy.contains('a', 'Back to the business directory').click();
    cy.get('article').should('have.length.at.least', 10);
    cy.contains('article h2', name).should('not.exist');

    cy.get('nav[aria-label="Main"]').contains('a', 'Profile').click();
    cy.contains('a', 'See how other members see your profile').click();
    cy.contains('dt', 'Submissions').next('dd').should('have.text', '1');
  });

  it('refuses a website that is not a web address', () => {
    registerAndOpenForm();
    fillEverything(`Cypress Cafe ${Date.now()}`);
    cy.get('input[type="url"]').clear().type('javascript:alert(1)');

    cy.contains('button', 'Submit for review').click();

    cy.contains('.field__error', 'Enter a web address that starts with http:// or https://.');
    cy.contains('h1', 'Add a business');
  });

  it('names the day that closes before it opens', () => {
    registerAndOpenForm();
    fillEverything(`Cypress Cafe ${Date.now()}`);
    timeInput('Monday closes').type('08:00');

    cy.contains('button', 'Submit for review').click();

    cy.contains('.field__error', 'Monday must close after it opens.');
  });

  it('lets the member add another business afterwards', () => {
    registerAndOpenForm();
    fillEverything(`Cypress Cafe ${Date.now()}`);
    cy.contains('button', 'Submit for review').click();
    cy.contains('h1', 'Business submitted');

    cy.contains('button', 'Add another business').click();

    cy.contains('h1', 'Add a business');
    cy.get('input[autocomplete="organization"]').should('have.value', '');
  });
});
