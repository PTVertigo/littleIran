// Week 8: comments, replies and reports on a forum post. Needs the API and web app running (npm run dev)
// and the sample data from `cd server && npm run seed:listings`. Each test registers a throwaway member and
// writes to its own new post in Cultural Exchange, so the sample posts are never flagged.

function field(label: string) {
  return cy.contains('label', label).then(($label) => cy.get(`[id="${$label.attr('for')}"]`));
}

function registerAndPost() {
  const email = `cypress-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  cy.visit('/register');
  cy.get('input[autocomplete="given-name"]').type('Comment');
  cy.get('input[autocomplete="family-name"]').type('Writer');
  cy.get('input[type="email"]').type(email);
  cy.get('input[autocomplete="new-password"]').type('OldPass1!{enter}');
  cy.location('pathname').should('eq', '/dashboard');

  cy.request('/api/categories?type=forum').its('body.categories').then((categories) => {
    const category = categories.find((c: { name: string }) => c.name === 'Cultural Exchange');
    cy.getCookie('csrf_token').then((csrf) => {
      cy.request({
        method: 'POST',
        url: '/api/forum/posts',
        headers: { 'X-CSRF-Token': csrf?.value ?? '' },
        body: { title: `Comment target ${Date.now()}`, categoryId: category.id, content: 'Please discuss.' },
      }).its('body.post.id').then((id) => cy.visit(`/forum/posts/${id}`));
    });
  });
  cy.contains('h2', 'Comments');
}

describe('Comments and reports on a forum post', () => {
  it('asks a visitor who is not logged in to log in', () => {
    cy.request('/api/forum/posts?search=Welcome').its('body.posts.0.id').then((id) => cy.visit(`/forum/posts/${id}`));

    cy.contains('main a', 'Log in').should('exist');
    cy.contains('button', 'Report this post').should('not.exist');
    cy.get('textarea').should('not.exist');
  });

  it('posts a comment, then a reply under it', () => {
    registerAndPost();
    cy.contains('No comments yet');

    field('Add a comment').type('First comment');
    cy.contains('button', 'Post comment').click();
    cy.contains('h2', 'Comments (1)');
    cy.contains('article', 'First comment').should('contain', 'Comment Writer');

    cy.contains('button', 'Reply').click();
    field('Reply to Comment Writer').type('A reply');
    cy.contains('button', 'Post reply').click();

    cy.contains('h2', 'Comments (2)');
    cy.get('.comment-list--replies').should('contain', 'A reply');
  });

  it('names an empty comment', () => {
    registerAndPost();

    cy.contains('button', 'Post comment').click();

    cy.contains('.field__error', 'Write your comment.');
  });

  it('shows markup in a comment as plain text', () => {
    registerAndPost();

    field('Add a comment').type('<img src=x onerror="window.hacked=true">', { parseSpecialCharSequences: false });
    cy.contains('button', 'Post comment').click();

    cy.contains('h2', 'Comments (1)');
    cy.get('.comment-list img').should('not.exist');
    cy.window().its('hacked').should('be.undefined');
  });

  it('reports a post with a reason and thanks the member, and the post stays visible', () => {
    registerAndPost();
    cy.location('pathname').then((path) => {
      const id = path.split('/').pop();

      cy.contains('button', 'Report this post').click();
      field('Why are you reporting it?').type('Spam');
      cy.contains('button', 'Send report').click();

      cy.get('[role="status"]').should('contain', 'The administrators will review this post');
      cy.request(`/api/forum/posts/${id}`).its('status').should('eq', 200);
    });
  });

  it('refuses comments and reports from a visitor with no session at the API', () => {
    cy.request({ method: 'POST', url: '/api/forum/posts/1/comments', body: { content: 'x' }, failOnStatusCode: false })
      .its('status').should('be.oneOf', [401, 403]);
    cy.request({ method: 'POST', url: '/api/forum/posts/1/flag', body: {}, failOnStatusCode: false })
      .its('status').should('be.oneOf', [401, 403]);
  });
});
