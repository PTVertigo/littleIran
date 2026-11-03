// REQ-3.4.2 Needs the API and web app running (npm run dev) and the sample data from `cd server && npm run seed:listings`.

describe('Event detail', () => {
  it('opens from the events page and shows the details and the organizer', () => {
    cy.visit('/events');
    cy.contains('article h2 a', 'Norouz Festival').click();

    cy.location('pathname').should('match', /^\/events\/\d+$/);
    cy.contains('h1', 'Norouz Festival');
    cy.contains('Festival');
    cy.contains('Haft-sin tables');
    cy.contains('dt', 'Date and time').next('dd').invoke('text')
      .should('match', /^[A-Z][a-z]{2}, [A-Z][a-z]+ \d{1,2}, \d{4}, 11:00 AM – 7:00 PM$/);
    cy.contains('dt', 'Location').next('dd').should('contain', 'Hamilton Convention Centre');
    cy.contains('h2', 'Organizer');
    cy.contains('dt', 'Name').next('dd').should('have.text', 'Hamilton Iranian Association');
    cy.contains('dt', 'Contact').next('dd').find('a').should('have.attr', 'href', 'mailto:hello@hamilton-iranian.example.com');
  });

  it('says when an event is over', () => {
    // Finished events come last, so on the second page
    cy.visit('/events?page=2');
    cy.contains('article h2 a', 'Mehregan Autumn Festival').click();

    cy.contains('Past event');
  });

  it('goes back to the events', () => {
    cy.visit('/events');
    cy.contains('article h2 a', 'Norouz Festival').click();

    cy.contains('a', 'Back to the events').click();

    cy.location('pathname').should('eq', '/events');
    cy.get('article').should('have.length', 10);
  });

  it('is open to a visitor who is not logged in', () => {
    cy.request('/api/events').its('body.events.0.id').then((id) => {
      cy.visit(`/events/${id}`);

      cy.get('main h1').should('be.visible');
      cy.location('pathname').should('eq', `/events/${id}`);
    });
  });

  it('says plainly when the event does not exist', () => {
    cy.visit('/events/99999999');
    cy.contains('h1', 'Event not found');
    cy.contains('a', 'Back to the events');
  });

  it('answers 404 for an id that is not a number, and changes nothing', () => {
    cy.request({ url: "/api/events/1'%20OR%20'1'='1", failOnStatusCode: false }).its('status').should('eq', 404);
    cy.request('/api/events').its('body.total').should('eq', 14);
  });
});
