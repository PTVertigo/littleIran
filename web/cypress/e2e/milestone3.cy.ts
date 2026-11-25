// Milestone 3 (Weeks 7 to 9: forums, flags and comments, administrator approval) in the browser, one test per
// case. Every title starts with its test plan ID or requirement number.
// Needs the API and web app running (npm run dev), the accounts from `cd server && npm run seed`
// (admin@test.com) and the sample data from `cd server && npm run seed:listings`.
// Run with:   npm run test:m3:cypress
// To watch the cases run in the Cypress window instead:   npm run cy:open   and pick milestone3.cy.ts
// Each run adds data, including one approved business and one approved event. Reset the local database before
// running the whole suite again, because the event specs count the sample events.

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

// A request to the API with the CSRF header the web app would send
function api(method: 'POST' | 'PUT', url: string, body: object = {}) {
  return cy.getCookie('csrf_token').then((csrf) => cy.request({ method, url, body, headers: { 'X-CSRF-Token': csrf?.value ?? '' } }));
}

function apiLogIn(email: string, password: string) {
  cy.clearCookies();
  cy.request({ url: '/api/auth/me', failOnStatusCode: false }); // any GET makes the server set the CSRF cookie
  api('POST', '/api/auth/login', { email, password });
}

const asAdmin = () => apiLogIn('admin@test.com', 'Admin123@');

// Registers a throwaway member and logs them in, so the seeded accounts are left alone
function asNewMember() {
  const email = `cypress-m3-${unique()}@example.com`;
  cy.clearCookies();
  cy.request({ url: '/api/auth/me', failOnStatusCode: false });
  api('POST', '/api/users', { email, password: 'OldPass1!', firstName: 'Mina', lastName: 'Member' });
  apiLogIn(email, 'OldPass1!');
  return cy.wrap(email);
}

const categoryId = (type: string, name: string) =>
  cy.request(`/api/categories?type=${type}`).its('body.categories').then((list) => list.find((c: { name: string }) => c.name === name).id as string);

// New posts go into Cultural Exchange, the one forum category no other spec counts
function createPost(title: string, content: string) {
  return categoryId('forum', 'Cultural Exchange').then((id) =>
    api('POST', '/api/forum/posts', { title, content, categoryId: id }).then((res) => res.body.post.id as string),
  );
}

// The member who is logged in submits a business, or an event, for review
function submitBusiness(name: string) {
  return categoryId('business', 'Restaurant').then((id) =>
    api('POST', '/api/businesses', {
      name, categoryId: id, description: 'Awaiting review.', street: '1 Test Street', city: 'Toronto', postalCode: 'M5V 2T6',
      phone: '(416) 555 0100', email: 'cafe@example.com', hours: [{ day: 1, opens: '09:00', closes: '17:00' }],
    }).then((res) => res.body.business.id as string),
  );
}

function submitEvent(title: string) {
  const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return categoryId('event', 'Educational').then((id) =>
    api('POST', '/api/events', {
      title, categoryId: id, description: 'Awaiting review.', location: 'Toronto', date, startTime: '19:00', endTime: '21:00',
      organizerName: 'Mina', organizerContact: 'mina@example.com',
    }).then((res) => res.body.event.id as string),
  );
}

// The input behind a visible label; ids from React contain colons, so match by attribute
function field(label: string) {
  return cy.contains('label', label).then(($label) => cy.get(`[id="${$label.attr('for')}"]`));
}

function approveOnAdminPage(title: string) {
  asAdmin();
  cy.visit('/admin');
  cy.contains('button', `Approve ${title}`).click();
  cy.get('[role="status"]').should('contain', `“${title}” was approved.`);
  cy.contains('article', title).should('not.exist');
}

function rejectOnAdminPage(title: string, reason: string) {
  asAdmin();
  cy.visit('/admin');
  cy.contains('button', `Reject ${title}`).click();
  cy.contains('article', title).find('textarea').type(reason);
  cy.contains('article', title).find('form').contains('button', 'Reject').click();
  cy.get('[role="status"]').should('contain', `“${title}” was rejected.`);
  cy.contains('article', title).should('not.exist');
}

// =========================================================================================================
// Week 7: the forum
// =========================================================================================================
describe('Forum', () => {
  it('REQ-3.5.1 view forum categories: the five categories are listed without logging in', () => {
    cy.visit('/forum');

    cy.get('article h3').then(($headings) => {
      expect([...$headings].map((h) => h.textContent)).to.deep.equal([
        'General Discussion', 'Business Recommendations', 'Event Planning', 'Cultural Exchange', 'Q&A',
      ]);
    });
  });

  it('REQ-3.5.2 view forum posts: opening a category lists its posts', () => {
    cy.visit('/forum');
    cy.contains('article h3 a', 'Business Recommendations').click();

    cy.contains('h1', 'Business Recommendations');
    cy.contains('article h2', 'A good Persian accountant?');
  });

  it('REQ-3.7.9 forum post pagination: 15 posts to a page, with a second page', () => {
    cy.visit('/forum');
    cy.contains('article h3 a', 'General Discussion').click();
    cy.get('article').should('have.length', 15);

    cy.get('nav[aria-label="Forum post pages"]').contains('button', 'Next').click();

    cy.get('nav[aria-label="Forum post pages"] [aria-current="page"]').should('have.text', '2');
    cy.get('article').should('have.length.at.least', 1);
  });

  // F3.3, F3.4 · forum post: title, category, content, Submit · expected: post created, confirmation shown
  it('FE-005 create forum post submission: title, category and content, then Publish post, shows the confirmation', () => {
    const title = `FE-005 post ${unique()}`;
    asNewMember();

    cy.visit('/forum/posts/new');
    cy.get('input[maxlength="150"]').type(title);
    cy.get('select').select('Cultural Exchange');
    cy.get('textarea').type('Which calligraphy books do you recommend?');
    cy.contains('button', 'Publish post').click();

    cy.contains('h1', 'Post published');
    cy.get('[role="status"]').should('contain', title);
  });

  it('REQ-3.7.3 search forum posts: a word from the content finds the post and shows its category', () => {
    const word = `word${unique()}`;
    asNewMember();
    createPost('Search target', `This post mentions ${word} once.`);

    cy.visit('/forum/search');
    cy.get('input[type="search"]').type(`${word}{enter}`);

    cy.get('article').should('have.length', 1).and('contain', 'Search target').and('contain', 'Cultural Exchange');
  });

  it('REQ-3.7.6 filter forum posts by category: only posts of the chosen category are shown', () => {
    cy.visit('/forum/search');

    cy.contains('.filter .chip', /^Q&A$/).click();

    cy.contains('.filter .chip', /^Q&A$/).should('have.attr', 'aria-pressed', 'true');
    cy.location('search').should('contain', 'category=Q%26A');
    cy.get('article').should('have.length.at.least', 1);
    cy.get('article .card__meta a').each(($link) => {
      expect($link.text()).to.equal('Q&A');
    });
  });

  it('REQ-3.5.2 open a single post: the title leads to the whole post', () => {
    const title = `Open me ${unique()}`;
    asNewMember();
    createPost(title, 'The full text of the post.');

    cy.visit('/forum');
    cy.contains('article h3 a', 'Cultural Exchange').click();
    cy.contains('article h2 a', title).click();

    cy.contains('article h1', title);
    cy.contains('The full text of the post.');
  });
});

// =========================================================================================================
// Week 8: comments, replies and flags
// =========================================================================================================
describe('Comments and flags', () => {
  it('REQ-3.5 comments and replies: a member comments on a post and replies to the comment', () => {
    asNewMember();
    createPost('Comment target', 'Please discuss.').then((id) => cy.visit(`/forum/posts/${id}`));

    field('Add a comment').type('First comment');
    cy.contains('button', 'Post comment').click();
    cy.contains('h2', 'Comments (1)');

    cy.contains('button', 'Reply').click();
    field('Reply to Mina Member').type('A reply');
    cy.contains('button', 'Post reply').click();

    cy.contains('h2', 'Comments (2)');
    cy.get('.comment-list--replies').should('contain', 'A reply');
  });

  it('REQ-3.5 flag a post: a member reports it and is told it will be reviewed', () => {
    asNewMember();
    createPost('Report target', 'Buy my product.').then((id) => cy.visit(`/forum/posts/${id}`));

    cy.contains('button', 'Report this post').click();
    field('Why are you reporting it?').type('Spam');
    cy.contains('button', 'Send report').click();

    cy.get('[role="status"]').should('contain', 'The administrators will review this post');
  });
});

// =========================================================================================================
// Week 9: administrator approval
// =========================================================================================================
describe('Administrator approval', () => {
  it('REQ-3.8.1 view pending submissions: the administrator sees a new business and event with who sent them', () => {
    const business = `Review Pending Cafe ${unique()}`;
    const event = `Review Pending Night ${unique()}`;
    asNewMember();
    submitBusiness(business);
    submitEvent(event);

    asAdmin();
    cy.visit('/dashboard');
    cy.get('nav a[href="/admin"]').click();

    cy.contains('article', business).should('contain', 'Submitted by Mina Member');
    cy.contains('article', event).should('contain', 'Submitted by Mina Member');
  });

  it('REQ-3.8.2 approve a business: it then appears on its public page', () => {
    const name = `Review Approved Cafe ${unique()}`;
    asNewMember();
    submitBusiness(name).then((id) => {
      approveOnAdminPage(name);
      cy.visit(`/businesses/${id}`);
      cy.contains('h1', name);
    });
  });

  it('REQ-3.8.3 reject a business with a reason: it stays unpublished', () => {
    const name = `Review Rejected Cafe ${unique()}`;
    asNewMember();
    submitBusiness(name).then((id) => {
      rejectOnAdminPage(name, 'Add the full address.');
      cy.request({ url: `/api/businesses/${id}`, failOnStatusCode: false }).its('status').should('eq', 404);
    });
  });

  it('REQ-3.8.4 approve an event: it then appears on its public page', () => {
    const title = `Review Approved Night ${unique()}`;
    asNewMember();
    submitEvent(title).then((id) => {
      approveOnAdminPage(title);
      cy.visit(`/events/${id}`);
      cy.contains('h1', title);
    });
  });

  it('REQ-3.8.5 reject an event with a reason: it stays unpublished', () => {
    const title = `Review Rejected Night ${unique()}`;
    asNewMember();
    submitEvent(title).then((id) => {
      rejectOnAdminPage(title, 'Name the venue.');
      cy.request({ url: `/api/events/${id}`, failOnStatusCode: false }).its('status').should('eq', 404);
    });
  });
});

// =========================================================================================================
// Member submissions
// =========================================================================================================
describe('Member submissions', () => {
  // A new member submits an event, the administrator rejects it, and the member is logged in again
  function rejectedEvent(title: string) {
    asNewMember().then((email) => {
      submitEvent(title).then((id) => {
        asAdmin();
        api('POST', `/api/admin/events/${id}/reject`, { reason: 'Say which venue it is at.' });
        apiLogIn(email, 'OldPass1!');
      });
    });
  }

  it('REQ-3.6.1 view own submissions: a member sees what they sent and its status', () => {
    const title = `My Night ${unique()}`;
    asNewMember();
    submitEvent(title);

    cy.visit('/dashboard');
    cy.contains('a', 'My submissions').click();

    cy.contains('article', title).should('contain', 'Status: Waiting for review');
  });

  it('REQ-3.6.2 receive feedback: a rejected submission shows the reason', () => {
    const title = `Feedback Night ${unique()}`;
    rejectedEvent(title);

    cy.visit('/submissions');

    cy.contains('article', title).should('contain', 'Status: Rejected').and('contain', 'Reason: Say which venue it is at.');
  });

  it('REQ-3.6.3 resubmit: the member edits a rejected event and sends it back for review', () => {
    const title = `Resubmit Night ${unique()}`;
    rejectedEvent(title);

    cy.visit('/submissions');
    cy.contains('article', title).contains('a', 'Edit and resubmit').click();
    cy.contains('h1', 'Resubmit your event');
    field('Location').clear().type('Hamilton Hall, 1 Main St');
    cy.contains('button', 'Resubmit for review').click();

    cy.contains('h1', 'Event resubmitted');
    cy.contains('a', 'See your submissions').click();
    cy.contains('article', title).should('contain', 'Status: Waiting for review').and('not.contain', 'Reason:');
  });
});

// =========================================================================================================
// Security testing in the browser (the XSS scan SEC-002 is run separately in OWASP ZAP)
// =========================================================================================================
describe('Security tests', () => {
  // F4.2, NF 4.1.4 · admin approval as a non-admin user · expected: 403 Forbidden
  it('API-005 admin approval authorization: a member is refused the admin page and gets 403', () => {
    asNewMember();

    cy.visit('/admin');
    cy.contains('h1', 'Not allowed');
    cy.get('nav a[href="/admin"]').should('not.exist');

    cy.getCookie('csrf_token').then((csrf) => {
      cy.request({
        method: 'POST', url: '/api/admin/approve', headers: { 'X-CSRF-Token': csrf?.value ?? '' }, failOnStatusCode: false,
      }).its('status').should('eq', 403);
    });
  });

  // NF 4.1.3 · input: `<script>alert('xss')</script>` · expected: shown as text, never run
  it("UT-004 XSS: <script>alert('xss')</script> in a forum post is shown as plain text and never runs", () => {
    const script = "<script>alert('xss')</script>";
    const alerted = cy.stub();
    cy.on('window:alert', alerted);
    asNewMember();

    createPost(script, script).then((id) => cy.visit(`/forum/posts/${id}`));

    cy.get('article h1').should('have.text', script);
    cy.get('.post-body').should('have.text', script);
    cy.get('article script').should('not.exist').then(() => expect(alerted).not.to.have.been.called);
  });
});
