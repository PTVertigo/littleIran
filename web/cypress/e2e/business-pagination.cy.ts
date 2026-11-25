// REQ-3.7.7 Needs the API and web app running (npm run dev) and the 15 sample businesses from
// `cd server && npm run seed:listings`. admin.cy.ts approves more of them, so the totals are read from the API.

const nav = () => cy.get('nav[aria-label="Business pages"]');

function withTotals(check: (total: number, totalPages: number) => void) {
  cy.request('/api/businesses').its('body').then(({ total, totalPages }) => {
    expect(total, 'enough businesses for a second page').to.be.at.least(15);
    check(total, totalPages);
  });
}

describe('Business directory pagination', () => {
  it('shows 10 businesses and the page navigation on the first page', () => {
    withTotals((total, totalPages) => {
      cy.visit('/businesses');

      cy.get('article').should('have.length', 10);
      cy.contains('[role="status"]', `Showing 1–10 of ${total} businesses. Page 1 of ${totalPages}.`);
      // Every page has a button up to 7 pages; past that only the first, the second and the last show here
      const numbers = totalPages <= 7 ? Array.from({ length: totalPages }, (_, i) => String(i + 1)) : ['1', '2', String(totalPages)];
      nav().find('button').then(($buttons) => {
        expect([...$buttons].map((b) => b.textContent)).to.deep.equal(['Previous', ...numbers, 'Next']);
      });
      nav().find('[aria-current="page"]').should('have.text', '1');
    });
  });

  it('shows the next businesses on the second page', () => {
    withTotals((total, totalPages) => {
      const last = Math.min(total, 20);
      cy.visit('/businesses');

      nav().contains('button', '2').click();

      cy.get('article').should('have.length', last - 10);
      cy.contains('[role="status"]', `Showing 11–${last} of ${total} businesses. Page 2 of ${totalPages}.`);
      cy.location('search').should('eq', '?page=2');
      nav().find('[aria-current="page"]').should('have.text', '2');
    });
  });

  it('never shows the same business on both pages', () => {
    withTotals((total) => {
      const expected = Math.min(total, 20);
      const seen: string[] = [];
      cy.visit('/businesses');
      cy.get('article h2').each(($h) => seen.push($h.text()));
      nav().contains('button', 'Next').click();
      cy.contains('[role="status"]', 'Page 2 of ');
      cy.get('article h2').each(($h) => seen.push($h.text())).then(() => {
        expect(seen).to.have.length(expected);
        expect(new Set(seen).size).to.equal(expected);
      });
    });
  });

  it('moves with Next and Previous, and the back button returns to the first page', () => {
    cy.visit('/businesses');

    nav().contains('button', 'Next').click();
    cy.contains('[role="status"]', 'Page 2 of ');
    nav().contains('button', 'Previous').click();
    cy.contains('[role="status"]', 'Page 1 of ');

    nav().contains('button', '2').click();
    cy.contains('[role="status"]', 'Page 2 of ');
    cy.go('back');
    cy.contains('[role="status"]', 'Page 1 of ');
  });

  it('can be used with the keyboard, and moves focus to the results line', () => {
    cy.visit('/businesses');

    // In our runs headless Electron did not turn a Cypress key press into a click on a focused button, so the Enter and
    // Space activation is covered by the React tests; here: it is a real button, the keyboard can focus it, and
    // using it keeps (or moves) focus where a keyboard user needs it.
    nav().contains('button', '2').should('match', 'button');
    nav().contains('button', '2').should('not.have.attr', 'tabindex');
    nav().contains('button', '2').focus().should('have.focus').click();

    cy.contains('[role="status"]', 'Page 2 of ').should('have.focus');
  });

  it('opens straight on the page in the address', () => {
    withTotals((total) => {
      cy.visit('/businesses?page=2');

      cy.get('article').should('have.length', Math.min(total, 20) - 10);
      nav().find('[aria-current="page"]').should('have.text', '2');
    });
  });

  it('explains a page past the end and goes back to the first page', () => {
    withTotals((_total, totalPages) => {
      cy.visit('/businesses?page=999');

      cy.contains(`There is no page 999. The results have ${totalPages} pages.`);
      cy.contains('button', 'Go to the first page').click();
      cy.get('article').should('have.length', 10);
    });
  });

  it('starts again from the first page when a category is chosen', () => {
    cy.visit('/businesses?page=2');

    // Retail, because admin.cy.ts approves a new Restaurant on every run
    cy.contains('.filter .chip', /^Retail$/).click();

    cy.location('search').should('eq', '?category=Retail');
    cy.get('article').should('have.length', 4);
    cy.get('nav[aria-label="Business pages"]').should('not.exist');
  });

  it('has no page navigation when the results fit on one page', () => {
    cy.visit('/businesses?search=persian');

    cy.get('article').should('have.length.at.least', 1);
    cy.get('nav[aria-label="Business pages"]').should('not.exist');
  });

  it('answers a page of 0, or text, as the first page', () => {
    cy.visit('/businesses?page=0');
    cy.contains('[role="status"]', 'Page 1 of ');
    cy.visit('/businesses?page=abc');
    cy.contains('[role="status"]', 'Page 1 of ');
  });

  it('is refused by the API for a page that is not a number', () => {
    cy.request({ url: '/api/businesses?page=1%20OR%201=1', failOnStatusCode: false }).then((res) => {
      expect(res.status).to.equal(400);
    });
  });
});
