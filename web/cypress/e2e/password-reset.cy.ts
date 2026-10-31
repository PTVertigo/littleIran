// Needs the API and web app running (npm run dev).
// The emailed link only appears in the API's console, so the full flow is checked by hand and in the API tests.

describe('Password reset', () => {
  // REQ-3.1.6 step 1
  it('asks for a reset link and gives the same answer for any address', () => {
    cy.visit('/login');
    cy.contains('a', 'Forgot your password?').click();
    cy.location('pathname').should('eq', '/forgot-password');

    cy.get('input[type="email"]').type('nobody@example.com{enter}');

    cy.contains('h1', 'Check your email');
    cy.get('[role="status"]').should('contain', 'If that email is registered');
  });

  it('rejects a malformed email before sending anything', () => {
    cy.intercept('POST', '/api/auth/forgot-password').as('forgot');
    cy.visit('/forgot-password');
    cy.get('input[type="email"]').type('test@invalid{enter}');

    cy.contains('.field__error', 'Enter a valid email address.');
    cy.get('@forgot.all').should('have.length', 0);
  });

  // REQ-3.1.6 step 2
  it('refuses a reset link the server does not recognise', () => {
    cy.visit('/reset-password?token=not-a-real-token');
    cy.get('input[autocomplete="new-password"]').type('NewPass1!{enter}');

    cy.get('[role="alert"]').should('contain', 'This reset link is invalid or has expired.');
    cy.contains('a', 'Request a new link').should('have.attr', 'href', '/forgot-password');
  });

  it('explains a link with no token', () => {
    cy.visit('/reset-password');

    cy.contains('h1', 'Reset link not valid');
  });
});
