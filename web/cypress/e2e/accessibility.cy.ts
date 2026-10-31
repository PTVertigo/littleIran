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

  it('a form showing its errors has no violations', () => {
    cy.visit('/register');
    cy.contains('button', 'Create account').click();
    cy.get('.field__error').should('have.length.at.least', 1);
    expectNoViolations();
  });
});
