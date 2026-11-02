// Needs the API and web app running (npm run dev) and the sample businesses from `cd server && npm run seed:listings`.

const searchBox = () => cy.get('input[type="search"]');

describe('Business search', () => {
  // REQ-3.7.1 / FE-003
  it('searching "Restaurant" shows the businesses with Restaurant in the name, and the Restaurant category', () => {
    cy.visit('/businesses');
    searchBox().type('Restaurant');
    cy.contains('button', 'Search').click();

    cy.location('search').should('eq', '?search=Restaurant');
    cy.contains('[role="status"]', 'found for “Restaurant”');
    cy.contains('article h2', 'Norouz Restaurant');
    cy.contains('article h2', 'Darband Restaurant');
    cy.contains('article h2', 'Golestan Restaurant');
    cy.contains('article h2', 'Pars Rug Gallery').should('not.exist');
    cy.get('article').each(($card) => {
      expect($card.text()).to.contain('Restaurant');
    });
  });

  it('ignores upper and lower case', () => {
    cy.visit('/businesses');
    searchBox().type('rEsTaUrAnT{enter}');

    cy.contains('article h2', 'Norouz Restaurant');
    cy.contains('article h2', 'Pars Rug Gallery').should('not.exist');
  });

  it('finds businesses by category', () => {
    cy.visit('/businesses');
    searchBox().type('retail{enter}');

    cy.get('article').should('have.length', 4);
    cy.contains('article h2', 'Pars Rug Gallery');
    cy.contains('article h2', 'Norouz Restaurant').should('not.exist');
  });

  it('needs every word to match', () => {
    cy.visit('/businesses');
    searchBox().type('persian kitchen{enter}');

    cy.get('article').should('have.length', 1);
    cy.contains('article h2', 'Shiraz Persian Kitchen');
  });

  it('says so, and offers to clear the search, when nothing matches', () => {
    cy.visit('/businesses');
    searchBox().type('zzzzzz{enter}');

    cy.contains('[role="status"]', 'No businesses match “zzzzzz”');
    cy.get('article').should('not.exist');

    cy.contains('button', 'Clear search').click();

    cy.get('article').should('have.length.at.least', 10);
    searchBox().should('have.value', '');
    cy.location('search').should('eq', '');
  });

  it('opens from a shared link', () => {
    cy.visit('/businesses?search=retail');

    searchBox().should('have.value', 'retail');
    cy.get('article').should('have.length', 4);
  });

  it('keeps the search when you open a business and come back', () => {
    cy.visit('/businesses?search=retail');
    cy.contains('article h2 a', 'Pars Rug Gallery').click();
    cy.location('pathname').should('match', /^\/businesses\/\d+$/);

    cy.go('back');

    cy.get('article').should('have.length', 4);
    searchBox().should('have.value', 'retail');
  });

  // API-004 / SEC-001
  it('treats a SQL injection attempt as ordinary text, and the directory still works afterwards', () => {
    cy.visit('/businesses');
    searchBox().type("'; DROP TABLE businesses;--{enter}");

    cy.contains('[role="status"]', 'No businesses match');
    cy.get('article').should('not.exist');

    cy.contains('button', 'Clear search').click();
    cy.get('article').should('have.length.at.least', 10);
  });

  it('shows a page of markup typed into the box as text only', () => {
    cy.visit('/businesses');
    searchBox().type('<img src=x onerror=alert(1)>{enter}');

    cy.contains('[role="status"]', 'No businesses match “<img src=x onerror=alert(1)>”');
    cy.get('main img').should('not.exist');
  });

  it('keeps the focus in the search box after searching, for keyboard users', () => {
    cy.visit('/businesses');
    searchBox().type('retail{enter}');

    cy.get('article').should('have.length', 4);
    searchBox().should('have.focus');
  });
});
