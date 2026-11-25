// REQ-3.7.3 / 3.7.6 Needs the API and web app running (npm run dev) and the sample data from
// `cd server && npm run seed:listings`. The sample posts include several about food and tea; other specs add
// posts to Cultural Exchange, so these checks avoid counting that category.

const chip = (name: string) => cy.contains('.filter .chip', new RegExp(`^${name}$`));
const searchBox = () => cy.get('input[type="search"]');

describe('Forum search and category filter', () => {
  it('is reached from the forum page and starts with every post, newest first', () => {
    cy.visit('/forum');
    cy.contains('a', 'Search posts').click();

    cy.location('pathname').should('eq', '/forum/search');
    cy.contains('h1', 'Search the forum');
    cy.get('article').should('have.length', 15);
    chip('All').should('have.attr', 'aria-pressed', 'true');
  });

  it('offers All and the five forum categories', () => {
    cy.visit('/forum/search');

    cy.get('.filter .chip').then(($chips) => {
      expect([...$chips].map((c) => c.textContent)).to.deep.equal([
        'All', 'General Discussion', 'Business Recommendations', 'Event Planning', 'Cultural Exchange', 'Q&A',
      ]);
    });
  });

  it('finds posts by words in the title or content and shows each category', () => {
    cy.visit('/forum/search');
    cy.get('article').should('have.length', 15);

    searchBox().type('tea{enter}');

    cy.get('[role="status"]').should('contain', 'found for “tea”');
    cy.get('article').should('have.length.at.least', 1);
    cy.get('article .card__meta a').each(($link) => {
      expect($link.text().length).to.be.greaterThan(0);
    });
    cy.location('search').should('eq', '?search=tea');
  });

  it('filters to one category and combines with the search', () => {
    cy.visit('/forum/search');

    chip('Q&A').click();
    cy.get('[role="status"]').should('contain', 'in Q&A');
    cy.get('article').each(($card) => {
      expect($card.find('.card__meta a').text()).to.equal('Q&A');
    });
    cy.location('search').should('eq', '?category=Q%26A');

    searchBox().type('zzzzzz{enter}');
    cy.contains('[role="status"]', 'No posts match “zzzzzz” in Q&A');
    cy.contains('button', 'Show all categories').click();
    cy.contains('[role="status"]', 'No posts match “zzzzzz”');
    cy.contains('button', 'Clear search').click();
    cy.get('article').should('have.length', 15);
  });

  it('opens from a shared link with the button already pressed', () => {
    cy.visit('/forum/search?category=Event%20Planning');

    chip('Event Planning').should('have.attr', 'aria-pressed', 'true');
    cy.get('article').should('have.length.at.least', 1);
  });

  // REQ-4.1.1 / API-004
  it('treats a SQL injection attempt as ordinary words', () => {
    cy.visit('/forum/search?search=' + encodeURIComponent("'; DROP TABLE forum_posts;--"));

    cy.contains('[role="status"]', 'No posts match');
    cy.visit('/forum/search');
    cy.get('article').should('have.length', 15);
  });

  it('is refused by the API for a search over 100 characters', () => {
    cy.request({ url: `/api/forum/posts?search=${'a'.repeat(101)}`, failOnStatusCode: false }).its('status').should('eq', 400);
  });
});
