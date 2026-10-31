// Needs the API and web app running (npm run dev) and the dev account from `cd server && npm run seed`

function logIn(email: string, password: string) {
  cy.visit('/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(`${password}{enter}`);
}

describe('Login', () => {
  // FE-001 (REQ-3.1.4, 3.1.5)
  it('FE-001 logs in with valid credentials and lands on the dashboard', () => {
    logIn('test@test.com', 'Test123@');

    cy.location('pathname').should('eq', '/dashboard');
    cy.contains('h1', 'Welcome, Test');
    cy.contains('You are logged in as test@test.com.');
  });

  // FE-002 (REQ-3.1.4)
  it('FE-002 shows Invalid credentials for a wrong password', () => {
    logIn('test@test.com', 'Wrong123@');

    cy.get('[role="alert"]').should('contain', 'Invalid credentials');
    cy.location('pathname').should('eq', '/login');
  });

  // REQ-3.1.4 an unregistered email gets the same answer as a wrong password
  it('shows Invalid credentials for an unknown email', () => {
    logIn('nobody@example.com', 'Test123@');

    cy.get('[role="alert"]').should('contain', 'Invalid credentials');
    cy.location('pathname').should('eq', '/login');
  });

  // REQ-3.1.4
  it('asks for both fields without sending anything', () => {
    cy.intercept('POST', '/api/auth/login').as('login');
    cy.visit('/login');
    cy.contains('button', 'Log in').click();

    cy.get('[role="alert"]').should('contain', 'Enter your email and password.');
    cy.get('@login.all').should('have.length', 0);
  });

  // REQ-3.1.5 the session cookie keeps a returning visitor logged in
  it('stays logged in after a reload', () => {
    logIn('test@test.com', 'Test123@');
    cy.location('pathname').should('eq', '/dashboard');

    cy.reload();

    cy.contains('h1', 'Welcome, Test');
  });

  // REQ-3.1.8
  it('logs out and sends the visitor back to the login page', () => {
    logIn('test@test.com', 'Test123@');
    cy.location('pathname').should('eq', '/dashboard');

    cy.contains('button', 'Log out').click();
    cy.visit('/dashboard');

    cy.location('pathname').should('eq', '/login');
  });
});
