// REQ-3.7.2 Needs the API and web app running (npm run dev) and the sample data from `cd server && npm run seed:listings`.

const searchBox = () => cy.get('input[type="search"]');

describe('Event search', () => {
  it('finds events by a word in the name', () => {
    cy.visit('/events');
    searchBox().type('Persian');
    cy.contains('button', 'Search').click();

    cy.location('search').should('eq', '?search=Persian');
    cy.contains('[role="status"]', '4 events found for “Persian”');
    cy.get('article').should('have.length', 4);
    cy.contains('article h2', 'Persian Calligraphy Workshop');
    cy.contains('article h2', 'Persian Film Night');
    cy.contains('article h2', 'Norouz Festival').should('not.exist');
  });

  it('ignores upper and lower case', () => {
    cy.visit('/events');
    searchBox().type('pErSiAn fIlM{enter}');

    cy.get('article').should('have.length', 1);
    cy.contains('article h2', 'Persian Film Night');
  });

  it('finds events by category', () => {
    cy.visit('/events');
    searchBox().type('workshop{enter}');

    cy.get('article').should('have.length', 2);
    cy.contains('article h2', 'Persian Calligraphy Workshop');
    cy.contains('article h2', 'Persian Cooking Class');
  });

  it('finds events by the Cultural Events category', () => {
    cy.visit('/events');
    searchBox().type('cultural{enter}');

    cy.get('article').should('have.length', 3);
    cy.get('article').each(($card) => {
      expect($card.find('.card__meta').text()).to.contain('Cultural Events');
    });
  });

  it('needs every word to match', () => {
    cy.visit('/events');
    searchBox().type('persian workshop{enter}');

    cy.get('article').should('have.length', 2);
  });

  it('says so, and offers to clear the search, when nothing matches', () => {
    cy.visit('/events');
    searchBox().type('zzzzzz{enter}');

    cy.contains('[role="status"]', 'No events match “zzzzzz”');
    cy.get('article').should('not.exist');

    cy.contains('button', 'Clear search').click();

    cy.get('article').should('have.length', 10);
    searchBox().should('have.value', '');
    cy.location('search').should('eq', '');
  });

  it('opens from a shared link', () => {
    cy.visit('/events?search=cultural');

    searchBox().should('have.value', 'cultural');
    cy.get('article').should('have.length', 3);
  });

  it('keeps the search when you open an event and come back', () => {
    cy.visit('/events?search=cultural');
    cy.contains('article h2 a', 'Persian Film Night').click();
    cy.location('pathname').should('match', /^\/events\/\d+$/);

    cy.go('back');

    cy.get('article').should('have.length', 3);
    searchBox().should('have.value', 'cultural');
  });

  // API-004 / SEC-001
  it('treats a SQL injection attempt as ordinary text, and the events still work afterwards', () => {
    cy.visit('/events');
    searchBox().type("'; DROP TABLE events;--{enter}");

    cy.contains('[role="status"]', 'No events match');
    cy.get('article').should('not.exist');

    cy.contains('button', 'Clear search').click();
    cy.get('article').should('have.length', 10);
  });

  it('shows markup typed into the box as text only', () => {
    cy.visit('/events');
    searchBox().type('<img src=x onerror=alert(1)>{enter}');

    cy.contains('[role="status"]', 'No events match “<img src=x onerror=alert(1)>”');
    cy.get('main img').should('not.exist');
  });

  it('keeps the focus in the search box after searching, for keyboard users', () => {
    cy.visit('/events');
    searchBox().type('workshop{enter}');

    cy.get('article').should('have.length', 2);
    searchBox().should('have.focus');
  });

  it('is refused by the API for a search over 100 characters', () => {
    cy.request({ url: `/api/events?search=${'a'.repeat(101)}`, failOnStatusCode: false }).its('status').should('eq', 400);
  });
});
