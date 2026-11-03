// Needs the API and web app running (npm run dev) and the sample businesses from `cd server && npm run seed:listings`.

describe('Business directory', () => {
  // REQ-3.3.1
  it('lists the approved businesses for a visitor who is not logged in', () => {
    cy.visit('/businesses');

    cy.contains('h1', 'Business directory');
    cy.get('article').should('have.length.at.least', 10);
    cy.contains('article h2', 'Norouz Restaurant').closest('article').should('contain', 'Restaurant').and('contain', 'Hamilton');
    cy.location('pathname').should('eq', '/businesses');
  });

  it('shows each business\'s category, city and description', () => {
    cy.visit('/businesses');

    cy.contains('article h2', 'Pars Rug Gallery')
      .closest('article')
      .should('contain', 'Retail · Oakville')
      .and('contain', 'rugs');
  });

  it('shows a count that matches the cards', () => {
    cy.visit('/businesses?category=Retail');

    cy.get('article').its('length').then((count) => {
      cy.contains('p', `${count} businesses`);
    });
  });

  // REQ-4.4.2 reachable in one click
  it('is reached from the home page button and from the navigation', () => {
    cy.visit('/');
    cy.contains('a', 'Browse businesses').click();
    cy.location('pathname').should('eq', '/businesses');

    cy.visit('/login');
    cy.get('nav[aria-label="Main"]').contains('a', 'Businesses').click();
    cy.location('pathname').should('eq', '/businesses');
    cy.contains('h1', 'Business directory');
  });

  it('is also open to a logged-in member', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('test@test.com');
    cy.get('input[type="password"]').type('Test123@{enter}');
    cy.location('pathname').should('eq', '/dashboard');

    cy.get('nav[aria-label="Main"]').contains('a', 'Businesses').click();

    cy.get('article').should('have.length.at.least', 10);
  });
});
