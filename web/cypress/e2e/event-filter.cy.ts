// REQ-3.7.5 / FE-004 Needs the API and web app running (npm run dev) and the sample data from
// `cd server && npm run seed:listings`: 14 approved events (the page shows 10 at a time), which are 3 Festival, 2 Workshop, 2 Celebration,
// 2 Educational, 2 Social Gathering and 3 Cultural Events.

const chip = (name: string) => cy.contains('.filter .chip', new RegExp(`^${name}$`));
const searchBox = () => cy.get('input[type="search"]');

describe('Event category filter', () => {
  it('offers All and every event category, with All pressed to start', () => {
    cy.visit('/events');

    cy.get('.filter .chip').then(($chips) => {
      expect([...$chips].map((c) => c.textContent)).to.deep.equal([
        'All', 'Festival', 'Workshop', 'Celebration', 'Educational', 'Social Gathering', 'Cultural Events',
      ]);
    });
    chip('All').should('have.attr', 'aria-pressed', 'true');
    cy.get('article').should('have.length', 10);
  });

  // FE-004
  it('selecting Cultural Events shows only the cultural events', () => {
    cy.visit('/events');

    chip('Cultural Events').click();

    cy.contains('[role="status"]', '3 events in Cultural Events');
    cy.get('article').should('have.length', 3);
    cy.get('article').each(($card) => {
      expect($card.find('.card__meta').text()).to.contain('Cultural Events');
    });
    cy.contains('article h2', 'Persian Film Night');
    cy.contains('article h2', 'Norouz Festival').should('not.exist');
    chip('Cultural Events').should('have.attr', 'aria-pressed', 'true');
    chip('All').should('have.attr', 'aria-pressed', 'false');
    cy.location('search').should('eq', '?category=Cultural+Events');
  });

  it('can switch from one category to another, and back to All', () => {
    cy.visit('/events');

    chip('Workshop').click();
    cy.get('article').should('have.length', 2);
    chip('Educational').click();
    cy.get('article').should('have.length', 2);
    cy.contains('article h2', 'Introduction to the Farsi Language');
    chip('All').click();

    cy.get('article').should('have.length', 10);
    cy.location('search').should('eq', '');
  });

  it('opens from a shared link with the button already pressed', () => {
    cy.visit('/events?category=Festival');

    cy.get('article').should('have.length', 3);
    chip('Festival').should('have.attr', 'aria-pressed', 'true');
  });

  it('keeps the events still to come before the finished ones inside a category', () => {
    cy.visit('/events?category=Festival');

    cy.get('article').eq(2).should('contain', 'Past event').and('contain', 'Mehregan Autumn Festival');
    cy.get('article').eq(0).should('not.contain', 'Past event');
  });

  it('works together with the search', () => {
    cy.visit('/events');
    chip('Cultural Events').click();
    cy.get('article').should('have.length', 3);

    searchBox().type('persian{enter}');

    cy.contains('[role="status"]', '1 event found for “persian” in Cultural Events');
    cy.location('search').should('eq', '?category=Cultural+Events&search=persian');
    cy.contains('article h2', 'Persian Film Night');

    cy.contains('button', 'Clear search').click();
    cy.get('article').should('have.length', 3);
    chip('Cultural Events').should('have.attr', 'aria-pressed', 'true');
  });

  it('says so, and offers to show every category, when the search finds nothing in the category', () => {
    cy.visit('/events?category=Workshop&search=orchestra');

    cy.contains('[role="status"]', 'No events match “orchestra” in Workshop');
    cy.contains('button', 'Show all categories').click();
    cy.contains('[role="status"]', 'No events match “orchestra”');
    cy.location('search').should('eq', '?search=orchestra');
  });

  it('treats a category that does not exist as one with no events', () => {
    cy.visit('/events?category=Grocery');

    cy.contains('[role="status"]', 'No events in Grocery yet.');
    cy.get('article').should('not.exist');
    cy.contains('button', 'Show all categories').click();
    cy.get('article').should('have.length', 10);
  });

  it('keeps the filter when you open an event and come back', () => {
    cy.visit('/events?category=Workshop');
    cy.contains('article h2 a', 'Persian Calligraphy Workshop').click();
    cy.location('pathname').should('match', /^\/events\/\d+$/);

    cy.go('back');

    cy.get('article').should('have.length', 2);
    chip('Workshop').should('have.attr', 'aria-pressed', 'true');
  });

  // REQ-4.1.1
  it('treats a SQL injection attempt in the address as an unknown category', () => {
    cy.visit('/events?category=' + encodeURIComponent("'; DROP TABLE events;--"));

    cy.contains('[role="status"]', 'No events in');
    cy.get('article').should('not.exist');
    cy.contains('button', 'Show all categories').click();
    cy.get('article').should('have.length', 10);
  });

  it('works from the keyboard, and keeps the focus on the button', () => {
    cy.visit('/events');
    cy.get('article').should('have.length', 10);

    chip('Workshop').focus().type('{enter}');

    cy.get('article').should('have.length', 2);
    chip('Workshop').should('have.focus');
  });

  it('is refused by the API for a category over 100 characters', () => {
    cy.request({ url: `/api/events?category=${'a'.repeat(101)}`, failOnStatusCode: false }).its('status').should('eq', 400);
  });
});
