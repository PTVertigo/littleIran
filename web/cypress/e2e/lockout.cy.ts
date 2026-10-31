// Needs the API and web app running (npm run dev).
// Locks a throwaway user registered by the test, never the seeded account.

const PASSWORD = 'Correct1!';

function attempt(email: string, password: string) {
  cy.visit('/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(`${password}{enter}`);
}

describe('Account lockout', () => {
  // SEC-005 (REQ-3.1.9, 4.1.6)
  it('locks the account on the fifth failed login and refuses even the right password', () => {
    const email = `cypress-lock-${Date.now()}@example.com`;
    cy.visit('/register');
    cy.get('input[autocomplete="given-name"]').type('Cypress');
    cy.get('input[autocomplete="family-name"]').type('Tester');
    cy.get('input[type="email"]').type(email);
    cy.get('input[autocomplete="new-password"]').type(`${PASSWORD}{enter}`);
    cy.location('pathname').should('eq', '/dashboard');
    cy.contains('button', 'Log out').click();

    for (let i = 1; i <= 4; i++) {
      attempt(email, 'Wrong123@');
      cy.get('[role="alert"]').should('contain', 'Invalid credentials');
    }

    attempt(email, 'Wrong123@');
    cy.get('[role="alert"]').should('contain', 'Try again in 30 minutes');

    attempt(email, PASSWORD);
    cy.get('[role="alert"]').should('contain', 'Try again in 30 minutes');
    cy.location('pathname').should('eq', '/login');
  });
});
