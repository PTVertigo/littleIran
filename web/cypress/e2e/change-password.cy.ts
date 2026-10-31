// Needs the API and web app running (npm run dev).
// Each test registers its own throwaway user, so the seeded account's password is never touched.

const OLD_PASSWORD = 'OldPass1!';
const NEW_PASSWORD = 'NewPass1!';

function registerAndOpenChangePassword() {
  const email = `cypress-${Date.now()}@example.com`;
  cy.visit('/register');
  cy.get('input[autocomplete="given-name"]').type('Cypress');
  cy.get('input[autocomplete="family-name"]').type('Tester');
  cy.get('input[type="email"]').type(email);
  cy.get('input[autocomplete="new-password"]').type(`${OLD_PASSWORD}{enter}`);
  cy.location('pathname').should('eq', '/dashboard');

  cy.contains('a', 'Change password').click();
  cy.location('pathname').should('eq', '/change-password');
  return email;
}

describe('Change password', () => {
  // REQ-3.1.7
  it('changes the password so only the new one logs in', () => {
    const email = registerAndOpenChangePassword();
    cy.get('input[autocomplete="current-password"]').type(OLD_PASSWORD);
    cy.get('input[autocomplete="new-password"]').type(`${NEW_PASSWORD}{enter}`);
    cy.get('[role="status"]').should('contain', 'Your password has been changed.');

    cy.contains('button', 'Log out').click();
    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(`${OLD_PASSWORD}{enter}`);
    cy.get('[role="alert"]').should('contain', 'Invalid credentials');

    cy.get('input[type="password"]').clear().type(`${NEW_PASSWORD}{enter}`);
    cy.location('pathname').should('eq', '/dashboard');
  });

  it('refuses a wrong current password', () => {
    registerAndOpenChangePassword();
    cy.get('input[autocomplete="current-password"]').type('Wrong123@');
    cy.get('input[autocomplete="new-password"]').type(`${NEW_PASSWORD}{enter}`);

    cy.contains('.field__error', 'Your current password is incorrect.');
  });

  // REQ-3.1.3
  it('rejects a weak new password before sending anything', () => {
    cy.intercept('POST', '/api/auth/change-password').as('change');
    registerAndOpenChangePassword();
    cy.get('input[autocomplete="current-password"]').type(OLD_PASSWORD);
    cy.get('input[autocomplete="new-password"]').type('weak{enter}');

    cy.contains('.field__error', 'Password must be 8-72 characters');
    cy.get('@change.all').should('have.length', 0);
  });
});
