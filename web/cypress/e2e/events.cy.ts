// REQ-3.4.1 Needs the API and web app running (npm run dev) and the sample data from
// `cd server && npm run seed:listings`: 14 approved events, 12 still to come and 2 that are over.

describe('Browse events', () => {
  it('lists the approved events without logging in', () => {
    cy.visit('/events');

    cy.contains('h1', 'Cultural events');
    cy.get('article').should('have.length', 14);
    cy.contains('[role="status"]', '14 events');
  });

  it('shows the title, category, date and time, location and description of each event', () => {
    cy.visit('/events');

    cy.contains('article', 'Norouz Festival').within(() => {
      cy.get('h2').should('have.text', 'Norouz Festival');
      cy.contains('Festival');
      cy.get('time').invoke('text').should('match', /^[A-Z][a-z]{2}, [A-Z][a-z]+ \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
      cy.contains('Hamilton Convention Centre');
      cy.contains('Haft-sin tables');
    });
  });

  it('puts the events still to come first, soonest first, and the finished ones last', () => {
    cy.visit('/events');

    cy.get('article time').then(($times) => {
      const starts = [...$times].map((t) => new Date(t.getAttribute('datetime') as string).getTime());
      const upcoming = starts.slice(0, 12);
      expect(upcoming).to.deep.equal([...upcoming].sort((a, b) => a - b));
      expect(upcoming[0]).to.be.greaterThan(Date.now());
      expect(starts[12]).to.be.lessThan(Date.now());
      expect(starts[12]).to.be.greaterThan(starts[13]);
    });
    cy.get('article').eq(12).should('contain', 'Past event');
    cy.get('article').eq(0).should('not.contain', 'Past event');
  });

  it('shows events from every category', () => {
    cy.visit('/events');

    ['Festival', 'Workshop', 'Celebration', 'Educational', 'Social Gathering', 'Cultural Events'].forEach((name) => {
      cy.contains('article .card__meta', name);
    });
  });

  it('is reached from the home page button and from the navigation', () => {
    cy.visit('/');
    cy.contains('a', 'Browse events').click();
    cy.location('pathname').should('eq', '/events');

    cy.visit('/login');
    cy.get('nav[aria-label="Main"]').contains('a', 'Events').click();
    cy.location('pathname').should('eq', '/events');
    cy.contains('h1', 'Cultural events');
  });

  it('only lists approved events in the API, with no contact details', () => {
    cy.request('/api/events').then((res) => {
      expect(res.status).to.equal(200);
      expect(res.body.events).to.have.length(14);
      res.body.events.forEach((event: object) => {
        expect(Object.keys(event).sort()).to.deep.equal(['category', 'description', 'id', 'location', 'past', 'startsAt', 'title']);
      });
    });
  });
});
