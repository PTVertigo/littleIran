// Needs the API and web app running (npm run dev).
// Registers its own throwaway user so the seeded account is never touched.

describe('Profile', () => {
  // REQ-3.2.1
  it('shows the logged-in user\'s own details, one click from the navigation', () => {
    const email = `cypress-${Date.now()}@example.com`;
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type(email);
    cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
    cy.location('pathname').should('eq', '/dashboard');

    cy.get('nav[aria-label="Main"]').contains('a', 'Profile').click();

    cy.location('pathname').should('eq', '/profile');
    cy.contains('h1', 'Your profile');
    cy.contains('dt', 'Email').next('dd').should('have.text', email);
    cy.contains('dt', 'First name').next('dd').should('have.text', 'Cypress');
    cy.contains('dt', 'Last name').next('dd').should('have.text', 'Tester');
    cy.contains('dt', 'Member since').next('dd').should('contain', new Date().getFullYear());
    cy.contains('dt', 'Role').next('dd').should('have.text', 'Regular user');
  });

  it('keeps a logged-out visitor out of the profile', () => {
    cy.visit('/profile');

    cy.location('pathname').should('eq', '/login');
  });
});
