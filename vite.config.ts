import tailwindcss from '@tailwindcss/vite';
import yaml from '@rollup/plugin-yaml';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Server } from 'node:http';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { attachRealtime } from './server/realtime.js';

function atloreRealtime(): Plugin {
  async function mount(server: Server | null) {
    if (!server) return;
    // Runtime secrets belong to the running dev/preview server. Loading dotenv
    // while the Vite config is evaluated can leak NODE_ENV=development into a
    // production build and retain SvelteKit's development-only diagnostics.
    await import('dotenv/config');
    const realtime = await attachRealtime(server);
    server.once('close', () => void realtime.close());
  }

  return {
    name: 'atlore-realtime',
    apply: 'serve',
    async configureServer(vite) {
      await mount(vite.httpServer as Server | null);
    },
    async configurePreviewServer(vite) {
      await mount(vite.httpServer as Server | null);
    }
  };
}

export default defineConfig({
  plugins: [atloreRealtime(), yaml(), tailwindcss(), sveltekit()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    include: ['src/**/*.{test,spec}.{ts,js}'],
    environment: 'jsdom',
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
