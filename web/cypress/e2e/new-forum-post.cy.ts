// REQ-3.5 / FE-005 Needs the API and web app running (npm run dev) and the sample data from
// `cd server && npm run seed:listings`. Registers a throwaway user for each test, so the seeded account is
// never touched. Posts are published at once and there is no way to delete one yet, so every post made here
// goes into Cultural Exchange, the one category no other spec counts.

// The input behind a visible label; ids from React contain colons, so match by attribute
function field(label: string) {
  return cy.contains('label', label).then(($label) => cy.get(`[id="${$label.attr('for')}"]`));
}

function registerAndOpenForm() {
  const email = `cypress-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  cy.visit('/register');
  cy.get('input[autocomplete="given-name"]').type('Forum');
  cy.get('input[autocomplete="family-name"]').type('Poster');
  cy.get('input[type="email"]').type(email);
  cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
  cy.location('pathname').should('eq', '/dashboard');

  cy.visit('/forum');
  cy.contains('a', 'New post').click();
  cy.location('pathname').should('eq', '/forum/posts/new');
  cy.contains('h1', 'New forum post');
  cy.get('select').should('be.visible');
}

describe('Write a forum post', () => {
  it('sends a logged-out visitor to log in first', () => {
    cy.visit('/forum/posts/new');

    cy.location('pathname').should('eq', '/login');
  });

  it('is reached from the forum page, with the five forum categories', () => {
    registerAndOpenForm();

    cy.get('select option').should('have.length', 6);
    cy.get('select option').then(($options) => {
      expect([...$options].map((o) => o.textContent)).to.deep.equal([
        'Choose a category',
        'General Discussion',
        'Business Recommendations',
        'Event Planning',
        'Cultural Exchange',
        'Q&A',
      ]);
    });
  });

  it('starts with the category chosen when the button on a category page is used', () => {
    registerAndOpenForm();
    cy.visit('/forum');
    cy.contains('article h3 a', 'Cultural Exchange').click();

    cy.contains('a', 'New post').click();

    cy.location('search').should('match', /^\?category=\d+$/);
    cy.get('select').find('option:selected').should('have.text', 'Cultural Exchange');
  });

  it('names every empty field and sends nothing', () => {
    registerAndOpenForm();

    cy.contains('button', 'Publish post').click();

    cy.get('[role="alert"]').should('contain', 'Check the fields marked below');
    cy.get('.field__error').should('have.length', 3);
    cy.contains('Enter a title for your post.');
    cy.contains('Choose a category.');
    cy.contains('Write your post.');
    cy.location('pathname').should('eq', '/forum/posts/new');
  });

  it('publishes a post, confirms it, and shows it first in its category', () => {
    const title = `Cypress post ${Date.now()}`;
    registerAndOpenForm();

    field('Title').type(title);
    cy.get('select').select('Cultural Exchange');
    field('Post').type('Which calligraphy books do you recommend?');
    cy.contains('button', 'Publish post').click();

    cy.contains('h1', 'Post published');
    cy.get('[role="status"]').should('contain', title).and('contain', 'Cultural Exchange');
    cy.contains('a', 'See the posts in Cultural Exchange').click();

    cy.contains('h1', 'Cultural Exchange');
    cy.get('article h2').first().should('have.text', title);
    cy.get('article').first().should('contain', 'Forum Poster').and('contain', '0 views');
  });

  it('shows markup in a post as plain text', () => {
    const title = `<b>bold</b> ${Date.now()}`;
    registerAndOpenForm();

    field('Title').type(title, { parseSpecialCharSequences: false });
    cy.get('select').select('Cultural Exchange');
    field('Post').type('<img src=x onerror="window.hacked=true">', { parseSpecialCharSequences: false });
    cy.contains('button', 'Publish post').click();
    cy.contains('a', 'See the posts in Cultural Exchange').click();

    cy.get('article h2').first().should('have.text', title);
    cy.get('article img').should('not.exist');
    cy.get('article h2 b').should('not.exist');
    cy.window().its('hacked').should('be.undefined');
  });

  it('refuses a post for a business category at the API', () => {
    registerAndOpenForm();
    cy.request('/api/categories?type=business').its('body.categories.0.id').then((categoryId) => {
      cy.getCookie('csrf_token').then((cookie) => {
        cy.request({
          method: 'POST',
          url: '/api/forum/posts',
          headers: { 'X-CSRF-Token': cookie?.value ?? '' },
          body: { title: 'Wrong place', categoryId, content: 'Not a forum category.' },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.equal(400);
          expect(res.body.errors).to.deep.equal({ categoryId: 'Choose a category.' });
        });
      });
    });
  });
});
