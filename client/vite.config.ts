/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom : nécessaire aux smoke tests de rendu (RTL). Les tests purs
    // (réducteur, URLs, routeur) s'exécutent tout aussi bien dans cet env.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
