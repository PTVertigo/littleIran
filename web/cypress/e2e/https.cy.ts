// SEC-003 (REQ-4.1.4, 4.1.5) HTTPS only. Run against the deployed site; every test skips on a local http address:
//   npm run cy:run -- --config baseUrl=https://littleiran.onrender.com --spec web/cypress/e2e/https.cy.ts

describe('HTTPS only', () => {
  beforeEach(function () {
    if (!Cypress.config('baseUrl')?.startsWith('https://')) this.skip();
  });

  const httpUrl = () => Cypress.config('baseUrl')!.replace('https://', 'http://');

  it('redirects plain http to https instead of answering', () => {
    cy.request({ url: httpUrl(), followRedirect: false }).then((res) => {
      expect(res.status).to.be.oneOf([301, 308]);
      expect(res.headers.location).to.match(/^https:\/\//);
    });
  });

  it('keeps the redirect on deep links, so a pasted http reset link still ends up on https', () => {
    cy.request({ url: `${httpUrl()}/reset-password?token=abc`, followRedirect: false }).then((res) => {
      expect(res.status).to.be.oneOf([301, 308]);
      expect(res.headers.location).to.match(/^https:\/\/.+\/reset-password\?token=abc$/);
    });
  });

  it('tells browsers to use https from now on (HSTS)', () => {
    cy.request('/').its('headers.strict-transport-security').should('match', /max-age=\d{7,}/);
  });

  it('marks the cookies Secure', () => {
    cy.request('/api/health').then((res) => {
      const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cookies.length, 'cookies set').to.be.greaterThan(0);
      cookies.forEach((cookie) => expect(cookie).to.match(/;\s*Secure/i));
    });
  });

  it('serves the app over https without loading anything from plain http', () => {
    cy.visit('/login');
    cy.location('protocol').should('eq', 'https:');
    cy.document().then((doc) => {
      const plainHttp = Array.from(doc.querySelectorAll('[src], [href]'))
        .map((el) => el.getAttribute('src') ?? el.getAttribute('href') ?? '')
        .filter((url) => url.startsWith('http://'));
      expect(plainHttp).to.deep.equal([]);
    });
  });
});
