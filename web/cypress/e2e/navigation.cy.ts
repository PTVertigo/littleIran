// REQ-4.4.2 intuitive navigation, REQ-4.3.2 / ACC-003 keyboard, REQ-4.3.3 page titles.
// Needs the API and web app running (npm run dev), the sample data from `cd server && npm run seed:listings`
// and the account from `cd server && npm run seed`.

function logIn() {
  cy.visit('/login');
  cy.get('input[type="email"]').type('test@test.com');
  cy.get('input[type="password"]').type('Test123@{enter}');
  cy.location('pathname').should('eq', '/dashboard');
}

describe('Navigation: any major section within 3 clicks (REQ-4.4.2)', () => {
  const nav = () => cy.get('nav[aria-label="Main"]');

  it('shows the main navigation on every page, clearly labelled', () => {
    ['/', '/businesses', '/events', '/login', '/register', '/no-such-page'].forEach((path) => {
      cy.visit(path);
      nav().should('be.visible');
      nav().contains('a', 'Businesses').should('be.visible');
      nav().contains('a', 'Events').should('be.visible');
    });
  });

  it('marks the page you are on in the navigation', () => {
    cy.visit('/events');
    nav().contains('a', 'Events').should('have.attr', 'aria-current', 'page');
    nav().contains('a', 'Businesses').should('not.have.attr', 'aria-current');
  });

  it('reaches the business directory, and one business, in 2 clicks from home', () => {
    cy.visit('/');
    nav().contains('a', 'Businesses').click(); // 1
    cy.contains('article h2 a', 'Norouz Restaurant').click(); // 2
    cy.contains('h1', 'Norouz Restaurant');
  });

  it('reaches the events, and one event, in 2 clicks from home', () => {
    cy.visit('/');
    nav().contains('a', 'Events').click(); // 1
    cy.contains('article h2 a', 'Norouz Festival').click(); // 2
    cy.contains('h1', 'Norouz Festival');
  });

  it('reaches the login and sign up pages in 1 click', () => {
    cy.visit('/');
    nav().contains('a', 'Log in').click();
    cy.location('pathname').should('eq', '/login');
    nav().contains('a', 'Sign up').click();
    cy.location('pathname').should('eq', '/register');
  });

  it('reaches every member section within 3 clicks of the dashboard', () => {
    logIn();
    nav().contains('a', 'Profile').click(); // 1
    cy.contains('h1', 'Your profile');
    cy.contains('a', 'Edit profile').click(); // 2
    cy.contains('h1', 'Edit profile');

    cy.get('nav[aria-label="Main"]').contains('a', 'Dashboard').click(); // 1
    cy.location('pathname').should('eq', '/dashboard');
  });

  it('reaches "Add a business" in 2 clicks and "Add an event" in 2 clicks', () => {
    logIn();
    nav().contains('a', 'Businesses').click(); // 1
    cy.contains('a', 'Add a business').click(); // 2
    cy.contains('h1', 'Add a business');

    nav().contains('a', 'Events').click(); // 1
    cy.contains('a', 'Add an event').click(); // 2
    cy.contains('h1', 'Add an event');
  });

  it('reaches the change password page in 1 click from the dashboard', () => {
    logIn();
    cy.contains('a', 'Change password').click(); // 1
    cy.contains('h1', 'Change password');
  });

  it('logs out from the navigation in 1 click', () => {
    logIn();
    nav().contains('button', 'Log out').click();
    cy.location('pathname').should('eq', '/');
    nav().contains('a', 'Log in').should('be.visible');
  });
});

describe('Page titles and focus (REQ-4.3.3, WCAG 2.4.2 and 2.4.3)', () => {
  it('gives each page its own title', () => {
    cy.visit('/');
    cy.title().should('eq', 'LittleIran');
    cy.visit('/businesses');
    cy.title().should('eq', 'Business directory – LittleIran');
    cy.visit('/events');
    cy.title().should('eq', 'Cultural events – LittleIran');
    cy.visit('/login');
    cy.title().should('eq', 'Log in – LittleIran');
    cy.visit('/no-such-page');
    cy.get('main h1').invoke('text').then((heading) => {
      cy.title().should('eq', `${heading} – LittleIran`);
    });
  });

  it('uses the name of a business or an event as the title of its page', () => {
    cy.visit('/businesses');
    cy.contains('article h2 a', 'Norouz Restaurant').click();
    cy.title().should('eq', 'Norouz Restaurant – LittleIran');

    cy.visit('/events');
    cy.contains('article h2 a', 'Norouz Festival').click();
    cy.title().should('eq', 'Norouz Festival – LittleIran');
  });

  it('moves focus to the main content when the page changes, and not when only the search changes', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'Events').click();
    cy.contains('h1', 'Cultural events');
    cy.get('main').should('have.focus');

    cy.get('input[type="search"]').type('film{enter}');
    cy.get('article').should('have.length', 1);
    cy.get('input[type="search"]').should('have.focus');
  });

  it('has a skip link that is the first stop for the keyboard and leads to the main content', () => {
    cy.visit('/events');
    cy.get('a.skip-link').focus().should('be.visible').and('contain', 'Skip to main content');
    cy.get('a.skip-link').click();
    cy.location('hash').should('eq', '#main');
    cy.get('main').should('have.focus');
  });
});
