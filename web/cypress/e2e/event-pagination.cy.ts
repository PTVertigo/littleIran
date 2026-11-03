// REQ-3.7.8 / FE-004 Needs the API and web app running (npm run dev) and the 14 sample events from
// `cd server && npm run seed:listings`, which make two pages: 10 and 4.

const nav = () => cy.get('nav[aria-label="Event pages"]');
const chip = (name: string) => cy.contains('.filter .chip', new RegExp(`^${name}$`));

describe('Events pagination', () => {
  it('shows 10 events and the page navigation on the first page', () => {
    cy.visit('/events');

    cy.get('article').should('have.length', 10);
    cy.contains('[role="status"]', 'Showing 1–10 of 14 events. Page 1 of 2.');
    nav().find('button').then(($buttons) => {
      expect([...$buttons].map((b) => b.textContent)).to.deep.equal(['Previous', '1', '2', 'Next']);
    });
    nav().find('[aria-current="page"]').should('have.text', '1');
  });

  it('shows the remaining 4 events on the second page, the finished ones last', () => {
    cy.visit('/events');

    nav().contains('button', '2').click();

    cy.get('article').should('have.length', 4);
    cy.contains('[role="status"]', 'Showing 11–14 of 14 events. Page 2 of 2.');
    cy.location('search').should('eq', '?page=2');
    cy.get('article').eq(2).should('contain', 'Past event');
    cy.get('article').eq(3).should('contain', 'Past event');
  });

  it('never shows the same event on both pages', () => {
    const seen: string[] = [];
    cy.visit('/events');
    cy.get('article h2').each(($h) => seen.push($h.text()));
    nav().contains('button', 'Next').click();
    cy.contains('[role="status"]', 'Page 2 of 2');
    cy.get('article h2').each(($h) => seen.push($h.text())).then(() => {
      expect(seen).to.have.length(14);
      expect(new Set(seen).size).to.equal(14);
    });
  });

  it('moves with Next and Previous, and the back button returns to the first page', () => {
    cy.visit('/events');

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
    cy.visit('/events');

    nav().contains('button', '2').focus().type('{enter}');

    cy.contains('[role="status"]', 'Page 2 of 2').should('have.focus');
  });

  it('opens straight on the page in the address', () => {
    cy.visit('/events?page=2');

    cy.get('article').should('have.length', 4);
    nav().find('[aria-current="page"]').should('have.text', '2');
  });

  it('explains a page past the end and goes back to the first page', () => {
    cy.visit('/events?page=9');

    cy.contains('There is no page 9. The results have 2 pages.');
    cy.contains('button', 'Go to the first page').click();
    cy.get('article').should('have.length', 10);
  });

  // FE-004: filter by 'Cultural Events' and only cultural events are displayed, with pagination
  it('shows only the cultural events, on one page with no navigation, when the category is chosen', () => {
    cy.visit('/events?page=2');

    chip('Cultural Events').click();

    cy.location('search').should('eq', '?category=Cultural+Events');
    cy.get('article').should('have.length', 3);
    cy.contains('[role="status"]', '3 events in Cultural Events');
    cy.get('nav[aria-label="Event pages"]').should('not.exist');
  });

  it('keeps the category when the page changes', () => {
    cy.visit('/events');
    chip('All').should('have.attr', 'aria-pressed', 'true');

    nav().contains('button', '2').click();
    chip('Festival').click();

    cy.location('search').should('eq', '?category=Festival');
    cy.get('article').should('have.length', 3);
  });

  it('has no page navigation when the results fit on one page', () => {
    cy.visit('/events?search=persian');

    cy.get('article').should('have.length', 4);
    cy.get('nav[aria-label="Event pages"]').should('not.exist');
  });

  it('answers a page of 0, or text, as the first page', () => {
    cy.visit('/events?page=0');
    cy.contains('[role="status"]', 'Page 1 of 2');
    cy.visit('/events?page=abc');
    cy.contains('[role="status"]', 'Page 1 of 2');
  });

  it('is refused by the API for a page that is not a number', () => {
    cy.request({ url: '/api/events?page=1%20OR%201=1', failOnStatusCode: false }).its('status').should('eq', 400);
  });
});
