// REQ-3.5.2 / REQ-3.7.9 Needs the API and web app running (npm run dev) and the sample data from
// `cd server && npm run seed:listings`: 16 posts in General Discussion (pages of 15 and 1) and 8 in other categories.

const nav = () => cy.get('nav[aria-label="Forum post pages"]');

function openCategory(name: string) {
  cy.visit('/forum');
  cy.contains('article h3 a', name).click();
}

describe('Forum category posts', () => {
  it('opens a category from the forum page and lists its posts without logging in', () => {
    openCategory('Business Recommendations');

    cy.location('pathname').should('match', /^\/forum\/categories\/\d+$/);
    cy.contains('h1', 'Business Recommendations');
    cy.contains('[role="status"]', '2 posts');
    cy.get('article').should('have.length', 2);
    cy.contains('article', 'A good Persian accountant?').within(() => {
      cy.get('h2').should('have.text', 'A good Persian accountant?');
      cy.contains('Former member');
      cy.get('time').invoke('text').should('match', /^[A-Z][a-z]{2}, [A-Z][a-z]+ \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
      cy.contains('0 views');
      cy.contains('tax filing');
    });
  });

  it('shows only the posts of the category that was opened', () => {
    openCategory('Q&A');

    cy.contains('h1', 'Q&A');
    cy.get('article').should('have.length', 2);
    cy.get('article').should('not.contain', 'Welcome to the LittleIran forum');
  });

  it('puts the newest post first', () => {
    openCategory('General Discussion');

    cy.get('article h2').first().should('have.text', 'Welcome to the LittleIran forum');
  });

  it('says so when the category does not exist, and links back to the forum', () => {
    cy.visit('/forum/categories/999999');

    cy.contains('h1', 'Category not found');
    cy.contains('a', 'All forum categories').click();
    cy.location('pathname').should('eq', '/forum');
  });

  it('reaches the posts in 2 clicks from the home page', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'Forum').click(); // 1
    cy.contains('article h3 a', 'Cultural Exchange').click(); // 2
    cy.contains('h1', 'Cultural Exchange');
  });
});

describe('Forum post pagination (REQ-3.7.9)', () => {
  it('shows 15 posts and the page navigation on the first page', () => {
    openCategory('General Discussion');

    cy.get('article').should('have.length', 15);
    cy.contains('[role="status"]', 'Showing 1–15 of 16 posts. Page 1 of 2.');
    nav().find('button').then(($buttons) => {
      expect([...$buttons].map((b) => b.textContent)).to.deep.equal(['Previous', '1', '2', 'Next']);
    });
    nav().find('[aria-current="page"]').should('have.text', '1');
  });

  it('shows the remaining post on the second page', () => {
    openCategory('General Discussion');

    nav().contains('button', '2').click();

    cy.get('article').should('have.length', 1);
    cy.contains('[role="status"]', 'Showing 16–16 of 16 posts. Page 2 of 2.');
    cy.location('search').should('eq', '?page=2');
    cy.get('article h2').should('have.text', 'Thank you, neighbours');
  });

  it('never shows the same post on both pages', () => {
    const seen: string[] = [];
    openCategory('General Discussion');
    cy.get('article h2').each(($h) => seen.push($h.text()));
    nav().contains('button', 'Next').click();
    cy.contains('[role="status"]', 'Page 2 of 2');
    cy.get('article h2').each(($h) => seen.push($h.text())).then(() => {
      expect(seen).to.have.length(16);
      expect(new Set(seen).size).to.equal(16);
    });
  });

  it('opens straight on a page typed into the address, and goes back with Previous', () => {
    openCategory('General Discussion');
    cy.location('pathname').then((path) => {
      cy.visit(`${path}?page=2`);
    });
    cy.contains('[role="status"]', 'Page 2 of 2');
    nav().contains('button', 'Previous').click();
    cy.contains('[role="status"]', 'Page 1 of 2');
    cy.location('search').should('eq', '');
  });

  it('answers the API with 15 posts at most, plus the totals', () => {
    cy.request('/api/categories?type=forum').its('body.categories.0.id').then((id) => {
      cy.request(`/api/forum/categories/${id}/posts`).then((res) => {
        expect(res.body.posts).to.have.length(15);
        expect(res.body).to.include({ pageSize: 15, total: 16, totalPages: 2 });
      });
    });
  });
});
