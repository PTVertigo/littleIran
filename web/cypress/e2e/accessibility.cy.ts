// ACC-001 to ACC-005 (REQ-4.3.x, WCAG 2.1 A and AA) checked with axe-core in a real browser.
// Needs the API and web app running (npm run dev) and the account from `cd server && npm run seed`.

import type { AxeResults } from 'axe-core';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

type AxeWindow = Window & { axe: { run: (context: Document, options: object) => Promise<AxeResults> }; eval: (code: string) => void };

function expectNoViolations() {
  cy.readFile('../node_modules/axe-core/axe.min.js', { log: false }).then((source: string) => {
    cy.window({ log: false }).then(async (win) => {
      const axeWin = win as unknown as AxeWindow;
      axeWin.eval(source);
      const results = await axeWin.axe.run(win.document, { runOnly: { type: 'tag', values: WCAG_TAGS } });
      const summary = results.violations
        .map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `  ${n.target.join(' ')} - ${n.failureSummary?.split('\n')[1]?.trim()}`).join('\n')}`)
        .join('\n');
      expect(results.violations, summary).to.have.length(0);
      // A clean result only counts if the contrast rule really ran on this page
      expect(results.passes.map((rule) => rule.id), 'rules that passed').to.include('color-contrast');
    });
  });
}

function logIn() {
  cy.visit('/login');
  cy.get('input[type="email"]').type('test@test.com');
  cy.get('input[type="password"]').type('Test123@{enter}');
  cy.location('pathname').should('eq', '/dashboard');
}

const publicPages = [
  ['home', '/'],
  ['business directory', '/businesses'],
  ['events', '/events'],
  ['forum', '/forum'],
  ['login', '/login'],
  ['register', '/register'],
  ['forgot password', '/forgot-password'],
  ['reset password', '/reset-password?token=abc'],
  ['reset link without a token', '/reset-password'],
  ['page not found', '/no-such-page'],
];

describe('Accessibility (axe, WCAG 2.1 A and AA)', () => {
  publicPages.forEach(([name, path]) => {
    it(`${name} page has no violations`, () => {
      cy.visit(path);
      // The page shows a spinner while it checks for a session, so wait for real content
      cy.get('main h1').should('be.visible');
      expectNoViolations();
    });
  });

  it('dashboard has no violations', () => {
    logIn();
    expectNoViolations();
  });

  it('business directory filtered by a category has no violations', () => {
    cy.visit('/businesses?category=Retail');
    // Wait for the buttons and the results, so the pressed button's colours are what gets scanned
    cy.get('.chip[aria-pressed="true"]').should('contain', 'Retail');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('second page of the business directory has no violations', () => {
    cy.visit('/businesses?page=2');
    cy.get('nav[aria-label="Business pages"] [aria-current="page"]').should('have.text', '2');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('business search results have no violations', () => {
    cy.visit('/businesses?search=restaurant');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('business search with no results has no violations', () => {
    cy.visit('/businesses?search=zzzzzz');
    cy.contains('No businesses match');
    expectNoViolations();
  });

  it('add a business page has no violations', () => {
    logIn();
    cy.visit('/businesses/new');
    cy.contains('h1', 'Add a business');
    cy.get('select').should('be.visible');
    expectNoViolations();
  });

  it('add a business page showing its errors has no violations', () => {
    logIn();
    cy.visit('/businesses/new');
    cy.get('select').should('be.visible');
    cy.contains('button', 'Submit for review').click();
    cy.get('.field__error').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('second page of the events has no violations', () => {
    cy.visit('/events?page=2');
    cy.get('nav[aria-label="Event pages"] [aria-current="page"]').should('have.text', '2');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('events filtered by a category have no violations', () => {
    cy.visit('/events?category=Cultural%20Events');
    // Wait for the buttons and the results, so the pressed button's colours are what gets scanned
    cy.get('.chip[aria-pressed="true"]').should('contain', 'Cultural Events');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('event search results have no violations', () => {
    cy.visit('/events?search=persian');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('event search with no results has no violations', () => {
    cy.visit('/events?search=zzzzzz');
    cy.contains('No events match');
    expectNoViolations();
  });

  it('add an event page has no violations', () => {
    logIn();
    cy.visit('/events/new');
    cy.contains('h1', 'Add an event');
    cy.get('select').should('be.visible');
    expectNoViolations();
  });

  it('add an event page showing its errors has no violations', () => {
    logIn();
    cy.visit('/events/new');
    cy.get('select').should('be.visible');
    cy.contains('button', 'Submit for review').click();
    cy.get('.field__error').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('business detail page has no violations', () => {
    cy.request('/api/businesses').its('body.businesses.0.id').then((id) => {
      cy.visit(`/businesses/${id}`);
      cy.contains('h2', 'Contact');
      expectNoViolations();
    });
  });

  it('event detail page has no violations', () => {
    cy.request('/api/events').its('body.events.0.id').then((id) => {
      cy.visit(`/events/${id}`);
      cy.contains('h2', 'Organizer');
      expectNoViolations();
    });
  });

  it('forum category page, and its second page, have no violations', () => {
    cy.request('/api/categories?type=forum').its('body.categories.0.id').then((id) => {
      cy.visit(`/forum/categories/${id}`);
      cy.get('article').should('have.length.at.least', 1);
      expectNoViolations();
      cy.visit(`/forum/categories/${id}?page=2`);
      cy.get('nav[aria-label="Forum post pages"] [aria-current="page"]').should('have.text', '2');
      expectNoViolations();
    });
  });

  it('forum search, with results and with none, has no violations', () => {
    cy.visit('/forum/search?category=General%20Discussion');
    cy.get('.chip[aria-pressed="true"]').should('contain', 'General Discussion');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
    cy.visit('/forum/search?search=zzzzzz');
    cy.contains('No posts match');
    expectNoViolations();
  });

  it('forum post page has no violations', () => {
    cy.request('/api/forum/posts').its('body.posts.0.id').then((id) => {
      cy.visit(`/forum/posts/${id}`);
      cy.get('article h1').should('be.visible');
      expectNoViolations();
    });
  });

  it('forum post with a comment and the reply form has no violations', () => {
    logIn();
    cy.request('/api/categories?type=forum').its('body.categories').then((categories) => {
      const category = categories.find((c: { name: string }) => c.name === 'Cultural Exchange');
      cy.getCookie('csrf_token').then((csrf) => {
        const headers = { 'X-CSRF-Token': csrf?.value ?? '' };
        cy.request({ method: 'POST', url: '/api/forum/posts', headers, body: { title: 'Axe target', categoryId: category.id, content: 'Text.' } })
          .its('body.post.id').then((id) => {
            cy.request({ method: 'POST', url: `/api/forum/posts/${id}/comments`, headers, body: { content: 'Axe check' } });
            cy.visit(`/forum/posts/${id}`);
          });
      });
    });
    cy.contains('article', 'Axe check');
    cy.contains('button', 'Reply').click();
    expectNoViolations();
  });

  it('new forum post page, empty and showing its errors, has no violations', () => {
    logIn();
    cy.visit('/forum/posts/new');
    cy.get('select').should('be.visible');
    expectNoViolations();
    cy.contains('button', 'Publish post').click();
    cy.get('.field__error').should('have.length', 3);
    expectNoViolations();
  });

  it('profile page has no violations', () => {
    logIn();
    cy.visit('/profile');
    cy.contains('dt', 'Email');
    expectNoViolations();
  });

  it('public profile page has no violations', () => {
    logIn();
    cy.request('/api/users/me').its('body.user.id').then((id) => {
      cy.visit(`/users/${id}`);
      cy.contains('dt', 'Submissions');
      expectNoViolations();
    });
  });

  it('edit profile page has no violations', () => {
    logIn();
    cy.visit('/profile/edit');
    cy.contains('h1', 'Edit profile');
    expectNoViolations();
  });

  it('change password page has no violations', () => {
    logIn();
    cy.visit('/change-password');
    cy.contains('h1', 'Change password');
    expectNoViolations();
  });

  it('a form showing its errors has no violations', () => {
    cy.visit('/register');
    cy.contains('button', 'Create account').click();
    cy.get('.field__error').should('have.length.at.least', 1);
    expectNoViolations();
  });

  // ACC-005
  it('keeps body text at 14px or larger', () => {
    cy.visit('/login');
    cy.get('body').should(($body) => {
      expect(parseFloat($body.css('font-size'))).to.be.at.least(14);
    });
    cy.get('p, label, input, button, a').each(($el) => {
      expect(parseFloat($el.css('font-size')), `${$el.prop('tagName')} "${$el.text().slice(0, 30)}"`).to.be.at.least(14);
    });
  });
});

// ACC-001 the colour scheme follows the visitor's system setting, so dark mode needs the same contrast
describe('Accessibility in dark mode', () => {
  before(() => {
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setEmulatedMedia',
      params: { features: [{ name: 'prefers-color-scheme', value: 'dark' }] },
    });
  });

  after(() => {
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setEmulatedMedia',
      params: { features: [{ name: 'prefers-color-scheme', value: 'light' }] },
    });
  });

  it('is really using the dark scheme', () => {
    cy.visit('/login');
    cy.window().then((win) => {
      expect(win.matchMedia('(prefers-color-scheme: dark)').matches).to.equal(true);
    });
  });

  publicPages.forEach(([name, path]) => {
    it(`${name} page has no violations`, () => {
      cy.visit(path);
      cy.get('main h1').should('be.visible');
      expectNoViolations();
    });
  });

  it('business directory filtered by a category has no violations', () => {
    cy.visit('/businesses?category=Retail');
    // Wait for the buttons and the results, so the pressed button's colours are what gets scanned
    cy.get('.chip[aria-pressed="true"]').should('contain', 'Retail');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('second page of the business directory has no violations', () => {
    cy.visit('/businesses?page=2');
    cy.get('nav[aria-label="Business pages"] [aria-current="page"]').should('have.text', '2');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('second page of the events has no violations', () => {
    cy.visit('/events?page=2');
    cy.get('nav[aria-label="Event pages"] [aria-current="page"]').should('have.text', '2');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('events filtered by a category have no violations', () => {
    cy.visit('/events?category=Cultural%20Events');
    cy.get('.chip[aria-pressed="true"]').should('contain', 'Cultural Events');
    cy.get('article').should('have.length.at.least', 1);
    expectNoViolations();
  });

  it('a form showing its errors has no violations', () => {
    cy.visit('/register');
    cy.contains('button', 'Create account').click();
    cy.get('.field__error').should('have.length.at.least', 1);
    expectNoViolations();
  });
});
