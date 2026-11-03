// Needs the API and web app running (npm run dev) and the sample businesses from `cd server && npm run seed:listings`.

describe('Business detail', () => {
  // REQ-3.3.2
  it('opens from the directory and shows the contact details and hours', () => {
    cy.visit('/businesses');
    cy.contains('article h2 a', 'Pars Rug Gallery').click();

    cy.location('pathname').should('match', /^\/businesses\/\d+$/);
    cy.contains('h1', 'Pars Rug Gallery');
    cy.contains('Retail · Oakville');
    cy.contains('Hand-knotted rugs');
    cy.contains('dt', 'Address').next('dd').should('have.text', '9 Example Road, Oakville L6H 5H8');
    cy.contains('dt', 'Phone').next('dd').find('a').should('have.attr', 'href', 'tel:9055550108');
    cy.contains('dt', 'Email').next('dd').find('a').should('have.attr', 'href').and('match', /^mailto:info@/);
  });

  it('lists all seven days and shows a closed day as Closed', () => {
    cy.visit('/businesses');
    cy.contains('article h2 a', 'Pars Rug Gallery').click();

    cy.get('table.hours tr').should('have.length', 7);
    cy.contains('table.hours tr', 'Monday').should('contain', '10:00 AM – 7:00 PM');
    cy.contains('table.hours tr', 'Saturday').should('contain', '10:00 AM – 7:00 PM');
    cy.contains('table.hours tr', 'Sunday').should('contain', 'Closed');
  });

  it('shows the website as a link only when the business has one', () => {
    cy.visit('/businesses');
    cy.contains('article h2 a', 'Norouz Restaurant').click();
    cy.contains('dt', 'Website').next('dd').find('a').should('have.attr', 'href', 'https://example.com/norouz');

    cy.contains('a', 'Back to the business directory').click();
    cy.contains('article h2 a', 'Pars Rug Gallery').click();
    cy.contains('dt', 'Website').should('not.exist');
  });

  it('goes back to the directory', () => {
    cy.visit('/businesses');
    cy.contains('article h2 a', 'Norouz Restaurant').click();

    cy.contains('a', 'Back to the business directory').click();

    cy.location('pathname').should('eq', '/businesses');
    cy.get('article').should('have.length.at.least', 10);
  });

  it('is open to a visitor who is not logged in', () => {
    cy.request('/api/businesses').its('body.businesses.0.id').then((id) => {
      cy.visit(`/businesses/${id}`);

      cy.get('main h1').should('be.visible');
      cy.location('pathname').should('eq', `/businesses/${id}`);
    });
  });

  it('says plainly when the business does not exist', () => {
    cy.visit('/businesses/99999999');
    cy.contains('h1', 'Business not found');

    cy.visit('/businesses/not-a-number');
    cy.contains('h1', 'Business not found');
  });
});
