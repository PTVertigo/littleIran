// REQ-3.5.1 Needs the API and web app running (npm run dev) and the migrations applied
// (`cd server && npm run migrate`), which add the forum categories.

describe('Forum categories', () => {
  it('lists the five forum categories without logging in', () => {
    cy.visit('/forum');

    cy.contains('h1', 'Discussion forum');
    cy.get('article h3').then(($titles) => {
      expect([...$titles].map((t) => t.textContent)).to.deep.equal([
        'General Discussion',
        'Business Recommendations',
        'Event Planning',
        'Cultural Exchange',
        'Q&A',
      ]);
    });
  });

  it('links each category to its posts', () => {
    cy.visit('/forum');

    cy.get('article h3 a').should('have.length', 5);
    cy.contains('article h3 a', 'Q&A').click();
    cy.location('pathname').should('match', /^\/forum\/categories\/\d+$/);
    cy.contains('h1', 'Q&A');
  });

  it('is reached from the navigation and from the home page button', () => {
    cy.visit('/');
    cy.contains('a', 'Join the forum').click();
    cy.location('pathname').should('eq', '/forum');

    cy.visit('/login');
    cy.get('nav[aria-label="Main"]').contains('a', 'Forum').click();
    cy.location('pathname').should('eq', '/forum');
    cy.get('nav[aria-label="Main"]').contains('a', 'Forum').should('have.attr', 'aria-current', 'page');
  });

  it('serves only forum categories to the API', () => {
    cy.request('/api/categories?type=forum').its('body.categories').should('have.length', 5);
  });
});
