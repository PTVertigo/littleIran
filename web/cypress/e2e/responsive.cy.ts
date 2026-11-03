// REQ-4.4.1 the pages work on a phone, a tablet and a desktop: nothing runs off the side of the screen,
// the navigation and the main actions stay reachable, and the layout adapts.
// Needs the API and web app running (npm run dev), the sample data from `cd server && npm run seed:listings`
// and the account from `cd server && npm run seed`.

const sizes = [
  ['phone', 360, 740],
  ['small phone', 320, 568],
  ['tablet', 768, 1024],
  ['desktop', 1280, 800],
] as const;

const pages = [
  ['home', '/'],
  ['business directory', '/businesses'],
  ['business directory, second page', '/businesses?page=2'],
  ['events', '/events'],
  ['events filtered and searched', '/events?category=Workshop&search=persian'],
  ['login', '/login'],
  ['register', '/register'],
  ['page not found', '/no-such-page'],
];

function noSideScroll() {
  cy.document().then((doc) => {
    const root = doc.documentElement;
    expect(root.scrollWidth, 'page width').to.be.at.most(root.clientWidth);
  });
}

describe('Responsive layout (REQ-4.4.1)', () => {
  sizes.forEach(([device, width, height]) => {
    describe(`${device} (${width}px wide)`, () => {
      beforeEach(() => {
        cy.viewport(width, height);
      });

      pages.forEach(([name, path]) => {
        it(`${name} does not scroll sideways`, () => {
          cy.visit(path);
          cy.get('main h1').should('be.visible');
          noSideScroll();
        });
      });

      it('keeps the navigation visible and every link inside the screen', () => {
        cy.visit('/');
        cy.get('nav[aria-label="Main"] a').each(($a) => {
          expect($a).to.be.visible;
          const rect = $a[0].getBoundingClientRect();
          expect(rect.left, 'left edge').to.be.at.least(0);
          expect(rect.right, 'right edge').to.be.at.most(width);
        });
      });

      it('event details and the event form fit the screen', () => {
        cy.request('/api/events').its('body.events.0.id').then((id) => {
          cy.visit(`/events/${id}`);
          cy.get('main h1').should('be.visible');
          noSideScroll();
        });
      });

      it('business details fit the screen', () => {
        cy.request('/api/businesses').its('body.businesses.0.id').then((id) => {
          cy.visit(`/businesses/${id}`);
          cy.contains('h2', 'Hours').should('be.visible');
          noSideScroll();
        });
      });

      it('the forms fit the screen and keep every field and button reachable', () => {
        cy.visit('/login');
        cy.get('input[type="email"]').type('test@test.com');
        cy.get('input[type="password"]').type('Test123@{enter}');
        cy.location('pathname').should('eq', '/dashboard');

        ['/businesses/new', '/events/new', '/profile', '/profile/edit'].forEach((path) => {
          cy.visit(path);
          cy.get('main h1').should('be.visible');
          noSideScroll();
        });
        cy.visit('/events/new');
        cy.contains('button', 'Submit for review').scrollIntoView().should('be.visible');
        cy.visit('/businesses/new');
        cy.contains('button', 'Submit for review').scrollIntoView().should('be.visible');
      });
    });
  });

  it('lays the cards out in more columns on a wider screen', () => {
    const columns = () =>
      cy.get('.card-grid > li').then(($items) => {
        const tops = new Set([...$items].map((li) => Math.round(li.getBoundingClientRect().top)));
        return $items.length / tops.size;
      });

    cy.viewport(360, 740);
    cy.visit('/businesses');
    cy.get('article').should('have.length', 10);
    columns().should('eq', 1);

    cy.viewport(1280, 800);
    columns().should('be.greaterThan', 1);
  });

  it('allows zooming, so people can enlarge the text', () => {
    cy.visit('/');
    cy.get('meta[name="viewport"]').should('have.attr', 'content').and('not.match', /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/);
  });
});
