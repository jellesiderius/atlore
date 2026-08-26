import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    include: ['src/**/*.{test,spec}.{ts,js}'],
    environment: 'jsdom',
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
