// REQ-3.8.1 to 3.8.5 / API-005 Needs the API and web app running (npm run dev) and the accounts from
// `cd server && npm run seed` (admin@test.com / Admin123@, test@test.com / Test123@). Each test submits its own
// listing as a throwaway member and decides only that one, so other pending items are left alone.

function logIn(email: string, password: string) {
  cy.visit('/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(`${password}{enter}`);
  cy.location('pathname').should('eq', '/dashboard');
}

function csrfHeaders() {
  return cy.getCookie('csrf_token').then((cookie) => ({ 'X-CSRF-Token': cookie?.value ?? '' }));
}

// Registers a member (who stays logged in) and submits a business and an event; returns their ids
function submitAsMember(tag: string) {
  const email = `cypress-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  cy.request({ url: '/api/auth/me', failOnStatusCode: false }); // any GET makes the server set the CSRF cookie
  csrfHeaders().then((headers) => {
    cy.request({ method: 'POST', url: '/api/users', headers, body: { email, password: 'OldPass1!', firstName: 'Pending', lastName: 'Member' } });
    cy.request({ method: 'POST', url: '/api/auth/login', headers, body: { email, password: 'OldPass1!' } });
  });
  const ids: { business?: string; event?: string; businessName: string; eventTitle: string } = {
    businessName: `Review Cafe ${tag}${Date.now()}`,
    eventTitle: `Review Night ${tag}${Date.now()}`,
  };
  cy.request('/api/categories?type=business').its('body.categories.0.id').then((categoryId) => {
    csrfHeaders().then((headers) => {
      cy.request({
        method: 'POST',
        url: '/api/businesses',
        headers,
        body: {
          name: ids.businessName, categoryId, description: 'Awaiting review.', street: '1 Test Street', city: 'Toronto',
          postalCode: 'M5V 2T6', phone: '(416) 555 0100', email: 'cafe@example.com', hours: [{ day: 1, opens: '09:00', closes: '17:00' }],
        },
      }).then((res) => { ids.business = res.body.business.id; });
    });
  });
  cy.request('/api/categories?type=event').its('body.categories.0.id').then((categoryId) => {
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    csrfHeaders().then((headers) => {
      cy.request({
        method: 'POST',
        url: '/api/events',
        headers,
        body: {
          title: ids.eventTitle, categoryId, description: 'Awaiting review.', location: 'Toronto', date, startTime: '19:00',
          endTime: '21:00', organizerName: 'Pending Member', organizerContact: 'host@example.com',
        },
      }).then((res) => { ids.event = res.body.event.id; });
    });
  });
  csrfHeaders().then((headers) => cy.request({ method: 'POST', url: '/api/auth/logout', headers }));
  return cy.wrap(ids);
}

describe('Administrator approval', () => {
  it('sends a visitor who is not logged in to log in', () => {
    cy.visit('/admin');

    cy.location('pathname').should('eq', '/login');
  });

  // API-005
  it('shows a member who is not an administrator that the page is not for them, and refuses the API', () => {
    logIn('test@test.com', 'Test123@');
    cy.get('nav a[href="/admin"]').should('not.exist');

    cy.visit('/admin');
    cy.contains('h1', 'Not allowed');

    cy.request({ url: '/api/admin/submissions', failOnStatusCode: false }).its('status').should('eq', 403);
    csrfHeaders().then((headers) => {
      cy.request({ method: 'POST', url: '/api/admin/businesses/1/approve', headers, failOnStatusCode: false }).its('status').should('eq', 403);
    });
  });

  it('lists what is pending and approves a business, which then appears in the directory', () => {
    submitAsMember('a').then((ids) => {
      logIn('admin@test.com', 'Admin123@');
      cy.get('nav a[href="/admin"]').click();
      cy.contains('h1', 'Administration');

      cy.contains('article', ids.businessName).should('contain', 'Submitted by Pending Member').and('contain', 'Awaiting review.');
      cy.contains('article', ids.eventTitle).should('exist');
      cy.contains('button', `Approve ${ids.businessName}`).click();

      cy.get('[role="status"]').should('contain', `“${ids.businessName}” was approved.`);
      cy.contains('article', ids.businessName).should('not.exist');
      cy.request(`/api/businesses/${ids.business}`).its('status').should('eq', 200);
      cy.request({ url: `/api/events/${ids.event}`, failOnStatusCode: false }).its('status').should('eq', 404);
    });
  });

  it('will not reject without a reason, then rejects an event with one, which stays unpublished', () => {
    submitAsMember('b').then((ids) => {
      logIn('admin@test.com', 'Admin123@');
      cy.visit('/admin');

      cy.contains('button', `Reject ${ids.eventTitle}`).click();
      cy.contains('article', ids.eventTitle).contains('button', 'Reject').click();
      cy.contains('article', ids.eventTitle).contains('.field__error', 'Give the reason for the rejection.');

      cy.contains('article', ids.eventTitle).find('textarea').type('The date clashes with another event.');
      cy.contains('article', ids.eventTitle).find('form').contains('button', 'Reject').click();

      cy.get('[role="status"]').should('contain', `“${ids.eventTitle}” was rejected.`);
      cy.contains('article', ids.eventTitle).should('not.exist');
      cy.request({ url: `/api/events/${ids.event}`, failOnStatusCode: false }).its('status').should('eq', 404);
      cy.contains('article', ids.businessName).should('exist');
    });
  });
});
