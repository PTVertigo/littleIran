import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // `npm run dev` from the repo root starts the API and the web app this points at
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false,
  },
});
