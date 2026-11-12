// Open a single forum post. Needs the API and web app running (npm run dev) and the sample data from
// `cd server && npm run seed:listings`.

describe('Forum post page', () => {
  it('opens from a title in the category, shows the whole post, and goes back to the category', () => {
    cy.request('/api/categories?type=forum').its('body.categories').then((categories) => {
      const general = categories.find((c: { name: string }) => c.name === 'General Discussion');
      cy.visit(`/forum/categories/${general.id}`);
    });
    cy.contains('article h2 a', 'Welcome to the LittleIran forum').click();

    cy.location('pathname').should('match', /^\/forum\/posts\/\d+$/);
    cy.contains('h1', 'Welcome to the LittleIran forum');
    cy.get('article .card__meta').should('contain', 'General Discussion').and('contain', 'view');
    cy.contains('a', 'Back to General Discussion').click();
    cy.location('pathname').should('match', /^\/forum\/categories\/\d+$/);
  });

  it('counts each time the post is opened', () => {
    cy.request('/api/forum/posts?search=Welcome').its('body.posts.0.id').then((id) => {
      cy.request(`/api/forum/posts/${id}`).its('body.post.views').then((before) => {
        cy.request(`/api/forum/posts/${id}`).its('body.post.views').should('eq', before + 1);
      });
    });
  });

  it('is opened from the search results too', () => {
    cy.visit('/forum/search?search=Welcome');
    cy.contains('article h2 a', 'Welcome to the LittleIran forum').click();
    cy.contains('h1', 'Welcome to the LittleIran forum');
  });

  it('says so for a post that does not exist', () => {
    cy.visit('/forum/posts/999999');
    cy.contains('h1', 'Post not found');
    cy.request({ url: '/api/forum/posts/999999', failOnStatusCode: false }).its('status').should('eq', 404);
  });
});
