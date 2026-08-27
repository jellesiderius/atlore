import tailwindcss from '@tailwindcss/vite';
import yaml from '@rollup/plugin-yaml';
import { sveltekit } from '@sveltejs/kit/vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { attachRealtime } from './server/realtime.js';

const { version: packageVersion } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string };

function sourceRevision() {
  const supplied = process.env.SOURCE_COMMIT?.trim();
  if (supplied) return supplied;
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

const revision =
  sourceRevision()
    .replace(/[^0-9A-Za-z._-]/g, '')
    .slice(0, 12) || 'dev';
const buildLabel = `v${packageVersion}.${revision}`;

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
  define: { __ATLORE_BUILD__: JSON.stringify(buildLabel) },
  plugins: [atloreRealtime(), yaml(), tailwindcss(), sveltekit()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    include: ['src/**/*.{test,spec}.{ts,js}'],
    environment: 'jsdom',
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
