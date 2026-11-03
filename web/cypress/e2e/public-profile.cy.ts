// Needs the API and web app running (npm run dev).
// Registers throwaway users so the seeded account is never touched.

function register(firstName: string, lastName: string) {
  const email = `cypress-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  cy.visit('/register');
  cy.get('input[autocomplete="given-name"]').type(firstName);
  cy.get('input[autocomplete="family-name"]').type(lastName);
  cy.get('input[type="email"]').type(email);
  cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
  cy.location('pathname').should('eq', '/dashboard');
  return email;
}

describe('Public profile', () => {
  // REQ-3.2.3
  it('shows another member\'s name and submission count, and nothing private', () => {
    const email = register('Public', 'Person');
    cy.request('/api/users/me').its('body.user.id').then((id) => {
      cy.contains('button', 'Log out').click();
      register('Other', 'Viewer');

      cy.visit(`/users/${id}`);

      cy.contains('h1', 'Public Person');
      cy.contains('dt', 'Submissions').next('dd').should('have.text', '0');
      cy.contains(email).should('not.exist');
      cy.contains('dt', 'Role').should('not.exist');
    });
  });

  it('is reached from your own profile', () => {
    register('Own', 'Preview');

    cy.get('nav[aria-label="Main"]').contains('a', 'Profile').click();
    cy.contains('a', 'See how other members see your profile').click();

    cy.location('pathname').should('match', /^\/users\/\d+$/);
    cy.contains('h1', 'Own Preview');
  });

  it('says plainly when the member does not exist', () => {
    register('Some', 'One');

    cy.visit('/users/99999999');
    cy.contains('h1', 'User not found');

    cy.visit('/users/not-a-number');
    cy.contains('h1', 'User not found');
  });

  it('asks a logged-out visitor to log in first', () => {
    cy.visit('/users/1');

    cy.location('pathname').should('eq', '/login');
  });
});
