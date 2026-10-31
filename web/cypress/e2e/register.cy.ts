// Needs the API and web app running (npm run dev). Each run registers a new address in the dev database.

describe('Registration', () => {
  // API-001 (REQ-3.1.1)
  it('creates an account, logs in and lands on the dashboard', () => {
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type(`cypress-${Date.now()}@example.com`);
    cy.get('input[autocomplete="new-password"]').type('Strong1!{enter}');

    cy.location('pathname').should('eq', '/dashboard');
    cy.contains('h1', 'Welcome, Cypress');
  });

  // REQ-3.1.2
  it('rejects a malformed email before sending anything', () => {
    cy.intercept('POST', '/api/users').as('register');
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type('test@invalid');
    cy.get('input[autocomplete="new-password"]').type('Strong1!{enter}');

    cy.contains('.field__error', 'Enter a valid email address.');
    cy.location('pathname').should('eq', '/register');
    cy.get('@register.all').should('have.length', 0);
  });

  // REQ-3.1.3
  it('rejects a weak password before sending anything', () => {
    cy.intercept('POST', '/api/users').as('register');
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type('weak@example.com');
    cy.get('input[autocomplete="new-password"]').type('weak{enter}');

    cy.contains('.field__error', 'Password must be 8-72 characters');
    cy.location('pathname').should('eq', '/register');
    cy.get('@register.all').should('have.length', 0);
  });

  // REQ-3.1.2 needs the account from `cd server && npm run seed`
  it('says when the email is already registered, ignoring case', () => {
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type('Test@Test.com');
    cy.get('input[autocomplete="new-password"]').type('Strong1!{enter}');

    cy.contains('.field__error', 'That email is already registered.');
    cy.location('pathname').should('eq', '/register');
  });
});
