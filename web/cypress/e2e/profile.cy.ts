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

  // REQ-3.2.2
  it('changes the name, and the new name shows on the profile and the dashboard', () => {
    const email = `cypress-${Date.now()}@example.com`;
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type(email);
    cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
    cy.location('pathname').should('eq', '/dashboard');

    cy.get('nav[aria-label="Main"]').contains('a', 'Profile').click();
    cy.contains('a', 'Edit profile').click();
    cy.location('pathname').should('eq', '/profile/edit');
    cy.get('input[autocomplete="given-name"]').should('have.value', 'Cypress');

    cy.get('input[autocomplete="given-name"]').clear().type('Changed');
    cy.get('input[autocomplete="family-name"]').clear().type('Person{enter}');
    cy.get('[role="status"]').should('contain', 'Your profile has been updated.');

    cy.contains('a', 'Back to profile').click();
    cy.contains('dt', 'First name').next('dd').should('have.text', 'Changed');
    cy.contains('dt', 'Last name').next('dd').should('have.text', 'Person');
    cy.contains('dt', 'Email').next('dd').should('have.text', email);

    cy.get('nav[aria-label="Main"]').contains('a', 'Dashboard').click();
    cy.contains('h1', 'Welcome, Changed');

    // The change is stored, not just remembered by the page
    cy.reload();
    cy.contains('h1', 'Welcome, Changed');
  });

  it('refuses a blank name and says which one', () => {
    const email = `cypress-${Date.now()}@example.com`;
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type(email);
    cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
    cy.location('pathname').should('eq', '/dashboard');
    cy.visit('/profile/edit');

    cy.get('input[autocomplete="given-name"]').clear();
    cy.contains('button', 'Save changes').click();

    cy.contains('.field__error', 'Enter your first name.');
    cy.get('[role="status"]').should('not.exist');
  });

  it('keeps a logged-out visitor out of the profile', () => {
    cy.visit('/profile');

    cy.location('pathname').should('eq', '/login');
  });
});
