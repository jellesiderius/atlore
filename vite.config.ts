import tailwindcss from '@tailwindcss/vite';
import yaml from '@rollup/plugin-yaml';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [yaml(), tailwindcss(), sveltekit()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    include: ['src/**/*.{test,spec}.{ts,js}'],
    environment: 'jsdom',
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
