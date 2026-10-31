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
});
