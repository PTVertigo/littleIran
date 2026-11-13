// REQ-3.6.1 to 3.6.3 Needs the API and web app running (npm run dev) and the accounts from `cd server && npm run seed`.
// Each test registers a throwaway member and an administrator account decides only that member's items.

function csrfHeaders() {
  return cy.getCookie('csrf_token').then((cookie) => ({ 'X-CSRF-Token': cookie?.value ?? '' }));
}

function logIn(email: string, password: string) {
  cy.visit('/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(`${password}{enter}`);
  cy.location('pathname').should('eq', '/dashboard');
}

// Registers a member, who stays logged in, and submits one event; returns its title and id
function memberWithEvent(): Cypress.Chainable<{ email: string; title: string; id: string }> {
  const email = `cypress-sub-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const title = `Resubmit Night ${Date.now()}`;
  cy.request({ url: '/api/auth/me', failOnStatusCode: false }); // any GET makes the server set the CSRF cookie
  csrfHeaders().then((headers) => {
    cy.request({ method: 'POST', url: '/api/users', headers, body: { email, password: 'OldPass1!', firstName: 'Sub', lastName: 'Mitter' } });
    cy.request({ method: 'POST', url: '/api/auth/login', headers, body: { email, password: 'OldPass1!' } });
  });
  return cy.request('/api/categories?type=event').its('body.categories.0.id').then((categoryId) => {
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    return csrfHeaders().then((headers) =>
      cy.request({
        method: 'POST',
        url: '/api/events',
        headers,
        body: { title, categoryId, description: 'Needs work.', location: 'Toronto', date, startTime: '19:00', endTime: '21:00', organizerName: 'Sub', organizerContact: 'sub@example.com' },
      }).then((res) => ({ email, title, id: res.body.event.id as string })),
    );
  });
}

describe('Member submissions', () => {
  it('sends a visitor who is not logged in to log in', () => {
    cy.visit('/submissions');

    cy.location('pathname').should('eq', '/login');
  });

  it('shows a member their own submission as waiting for review, reached from the dashboard', () => {
    memberWithEvent().then((event) => {
      cy.visit('/dashboard');
      cy.contains('a', 'My submissions').click();

      cy.contains('h1', 'My submissions');
      cy.contains('article', event.title).should('contain', 'Status: Waiting for review');
      cy.contains('a', 'Edit and resubmit').should('not.exist');
    });
  });

  it('shows the reason after a rejection, lets the member fix the event and sends it back for review', () => {
    memberWithEvent().then((event) => {
      // An administrator rejects it
      cy.request({ url: '/api/auth/me', failOnStatusCode: false });
      csrfHeaders().then((headers) => {
        cy.request({ method: 'POST', url: '/api/auth/logout', headers });
      });
      cy.request({ url: '/api/auth/me', failOnStatusCode: false });
      csrfHeaders().then((headers) => {
        cy.request({ method: 'POST', url: '/api/auth/login', headers, body: { email: 'admin@test.com', password: 'Admin123@' } });
      });
      csrfHeaders().then((headers) => {
        cy.request({ method: 'POST', url: `/api/admin/events/${event.id}/reject`, headers, body: { reason: 'Say which venue it is at.' } });
        cy.request({ method: 'POST', url: '/api/auth/logout', headers });
      });

      // The member sees why
      cy.request({ url: '/api/auth/me', failOnStatusCode: false });
      logIn(event.email, 'OldPass1!');
      cy.visit('/submissions');
      cy.contains('article', event.title).should('contain', 'Status: Rejected').and('contain', 'Reason: Say which venue it is at.');
      cy.contains('article', event.title).contains('a', 'Edit and resubmit').click();

      // The form is filled in, with the reason on top
      cy.contains('h1', 'Resubmit your event');
      cy.contains('[role="note"]', 'Reason it was rejected: Say which venue it is at.');
      cy.get('input').filter(`[value="${event.title}"]`).should('exist');
      cy.contains('label', 'Location').then(($label) => cy.get(`[id="${$label.attr('for')}"]`)).clear().type('Hamilton Hall, 1 Main St');
      cy.contains('button', 'Resubmit for review').click();

      cy.contains('h1', 'Event resubmitted');
      cy.contains('a', 'See your submissions').click();
      cy.contains('article', event.title).should('contain', 'Status: Waiting for review').and('not.contain', 'Reason:');
    });
  });

  it('will not open someone else\'s submission, or one that is not rejected', () => {
    memberWithEvent().then((event) => {
      cy.request({ url: `/api/submissions/events/${event.id}`, failOnStatusCode: false }).its('status').should('eq', 404);
      cy.visit(`/events/new?resubmit=${event.id}`);
      cy.get('[role="alert"]').should('contain', 'cannot be resubmitted');
    });
  });
});
