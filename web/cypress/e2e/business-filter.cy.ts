// Needs the API and web app running (npm run dev) and the sample businesses from `cd server && npm run seed:listings`.
// The sample data has 6 Restaurant, 4 Retail, 2 Professional Services and 1 each of Services, Entertainment
// and Health & Wellness businesses, 15 in all (the directory shows 10 to a page, so All has 2 pages).

const chip = (name: string) => cy.contains('.filter .chip', new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
const searchBox = () => cy.get('input[type="search"]');

describe('Business category filter', () => {
  // REQ-3.7.4
  it('offers All and every business category, with All pressed to start', () => {
    cy.visit('/businesses');

    cy.get('.filter .chip').should('have.length', 7);
    cy.get('.filter .chip').then(($chips) => {
      expect([...$chips].map((c) => c.textContent)).to.deep.equal([
        'All', 'Restaurant', 'Retail', 'Services', 'Professional Services', 'Entertainment', 'Health & Wellness',
      ]);
    });
    chip('All').should('have.attr', 'aria-pressed', 'true');
    cy.get('article').should('have.length', 10);
  });

  it('shows only the businesses in the category that was chosen', () => {
    cy.visit('/businesses');

    chip('Retail').click();

    cy.contains('[role="status"]', '4 businesses in Retail');
    cy.get('article').should('have.length', 4);
    cy.get('article').each(($card) => {
      expect($card.text()).to.contain('Retail');
    });
    cy.contains('article h2', 'Pars Rug Gallery');
    cy.contains('article h2', 'Norouz Restaurant').should('not.exist');
    chip('Retail').should('have.attr', 'aria-pressed', 'true');
    chip('All').should('have.attr', 'aria-pressed', 'false');
    cy.location('search').should('eq', '?category=Retail');
  });

  it('can switch from one category to another, and back to All', () => {
    cy.visit('/businesses');

    chip('Restaurant').click();
    cy.get('article').should('have.length', 6);
    chip('Professional Services').click();
    cy.get('article').should('have.length', 2);
    cy.contains('article h2', 'Alborz Accounting');
    chip('All').click();

    cy.get('article').should('have.length', 10);
    cy.location('search').should('eq', '');
  });

  it('finds a category with an ampersand in its name', () => {
    cy.visit('/businesses');

    chip('Health & Wellness').click();

    cy.contains('[role="status"]', '1 business in Health & Wellness');
    cy.contains('article h2', 'Hafez Wellness Clinic');
    cy.location('search').should('eq', '?category=Health+%26+Wellness');
  });

  it('works together with the search', () => {
    cy.visit('/businesses');
    searchBox().type('persian{enter}');
    cy.contains('[role="status"]', 'found for “persian”');

    chip('Restaurant').click();

    cy.contains('[role="status"]', '1 business found for “persian” in Restaurant');
    cy.contains('article h2', 'Shiraz Persian Kitchen');
    cy.location('search').should('eq', '?search=persian&category=Restaurant');
  });

  it('opens from a shared link, with the right button pressed', () => {
    cy.visit('/businesses?category=Retail');

    cy.get('article').should('have.length', 4);
    chip('Retail').should('have.attr', 'aria-pressed', 'true');
  });

  it('says so, and offers to show every category, when a category has no match', () => {
    cy.visit('/businesses?category=Grocery');

    cy.contains('[role="status"]', 'No businesses in Grocery yet.');
    cy.get('article').should('not.exist');

    cy.contains('button', 'Show all categories').click();

    cy.get('article').should('have.length', 10);
    chip('All').should('have.attr', 'aria-pressed', 'true');
  });

  it('keeps the filter when you open a business and come back', () => {
    cy.visit('/businesses?category=Retail');
    cy.contains('article h2 a', 'Pars Rug Gallery').click();
    cy.location('pathname').should('match', /^\/businesses\/\d+$/);

    cy.go('back');

    cy.get('article').should('have.length', 4);
    chip('Retail').should('have.attr', 'aria-pressed', 'true');
  });

  // REQ-4.1.1
  it('treats a SQL injection attempt in the address as an unknown category', () => {
    cy.visit("/businesses?category=" + encodeURIComponent("'; DROP TABLE businesses;--"));

    cy.contains('[role="status"]', 'No businesses in');
    cy.get('article').should('not.exist');
    cy.contains('button', 'Show all categories').click();
    cy.get('article').should('have.length', 10);
  });

  it('works from the keyboard', () => {
    cy.visit('/businesses');
    cy.get('article').should('have.length', 10);

    chip('Retail').focus().type('{enter}');

    cy.get('article').should('have.length', 4);
    chip('Retail').should('have.focus');
  });
});
