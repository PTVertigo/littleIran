import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // The API is served from the page's own origin, so session cookies stay first-party and no CORS is needed
    proxy: { '/api': 'http://localhost:3000' },
  },
});
