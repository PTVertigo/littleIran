// REQ-3.7.7 Needs the API and web app running (npm run dev) and the 15 sample businesses from
// `cd server && npm run seed:listings`, which make two pages: 10 and 5.

const nav = () => cy.get('nav[aria-label="Business pages"]');

describe('Business directory pagination', () => {
  it('shows 10 businesses and the page navigation on the first page', () => {
    cy.visit('/businesses');

    cy.get('article').should('have.length', 10);
    cy.contains('[role="status"]', 'Showing 1–10 of 15 businesses. Page 1 of 2.');
    nav().find('button').then(($buttons) => {
      expect([...$buttons].map((b) => b.textContent)).to.deep.equal(['Previous', '1', '2', 'Next']);
    });
    nav().find('[aria-current="page"]').should('have.text', '1');
  });

  it('shows the remaining 5 businesses on the second page', () => {
    cy.visit('/businesses');

    nav().contains('button', '2').click();

    cy.get('article').should('have.length', 5);
    cy.contains('[role="status"]', 'Showing 11–15 of 15 businesses. Page 2 of 2.');
    cy.location('search').should('eq', '?page=2');
    nav().find('[aria-current="page"]').should('have.text', '2');
  });

  it('never shows the same business on both pages', () => {
    const seen: string[] = [];
    cy.visit('/businesses');
    cy.get('article h2').each(($h) => seen.push($h.text()));
    nav().contains('button', 'Next').click();
    cy.contains('[role="status"]', 'Page 2 of 2');
    cy.get('article h2').each(($h) => seen.push($h.text())).then(() => {
      expect(seen).to.have.length(15);
      expect(new Set(seen).size).to.equal(15);
    });
  });

  it('moves with Next and Previous, and the back button returns to the first page', () => {
    cy.visit('/businesses');

    nav().contains('button', 'Next').click();
    cy.contains('[role="status"]', 'Page 2 of 2');
    nav().contains('button', 'Previous').click();
    cy.contains('[role="status"]', 'Page 1 of 2');

    nav().contains('button', '2').click();
    cy.contains('[role="status"]', 'Page 2 of 2');
    cy.go('back');
    cy.contains('[role="status"]', 'Page 1 of 2');
  });

  it('can be used with the keyboard, and moves focus to the results line', () => {
    cy.visit('/businesses');

    nav().contains('button', '2').focus().type('{enter}');

    cy.contains('[role="status"]', 'Page 2 of 2').should('have.focus');
  });

  it('opens straight on the page in the address', () => {
    cy.visit('/businesses?page=2');

    cy.get('article').should('have.length', 5);
    nav().find('[aria-current="page"]').should('have.text', '2');
  });

  it('explains a page past the end and goes back to the first page', () => {
    cy.visit('/businesses?page=9');

    cy.contains('There is no page 9. The results have 2 pages.');
    cy.contains('button', 'Go to the first page').click();
    cy.get('article').should('have.length', 10);
  });

  it('starts again from the first page when a category is chosen', () => {
    cy.visit('/businesses?page=2');

    cy.contains('.filter .chip', /^Restaurant$/).click();

    cy.location('search').should('eq', '?category=Restaurant');
    cy.get('article').should('have.length', 6);
    cy.get('nav[aria-label="Business pages"]').should('not.exist');
  });

  it('has no page navigation when the results fit on one page', () => {
    cy.visit('/businesses?search=persian');

    cy.get('article').should('have.length.at.least', 1);
    cy.get('nav[aria-label="Business pages"]').should('not.exist');
  });

  it('answers a page of 0, or text, as the first page', () => {
    cy.visit('/businesses?page=0');
    cy.contains('[role="status"]', 'Page 1 of 2');
    cy.visit('/businesses?page=abc');
    cy.contains('[role="status"]', 'Page 1 of 2');
  });

  it('is refused by the API for a page that is not a number', () => {
    cy.request({ url: '/api/businesses?page=1%20OR%201=1', failOnStatusCode: false }).then((res) => {
      expect(res.status).to.equal(400);
    });
  });
});
