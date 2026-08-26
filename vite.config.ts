import tailwindcss from '@tailwindcss/vite';
import yaml from '@rollup/plugin-yaml';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Server } from 'node:http';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { attachRealtime } from './server/realtime.js';

function atloreRealtime(): Plugin {
  return {
    name: 'atlore-realtime',
    apply: 'serve',
    async configureServer(vite) {
      if (!vite.httpServer) return;
      const realtime = await attachRealtime(vite.httpServer as Server);
      vite.httpServer.once('close', () => void realtime.close());
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
