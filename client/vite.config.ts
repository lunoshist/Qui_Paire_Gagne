/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test trivial et pur : pas besoin de DOM ni de WebSocket.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
