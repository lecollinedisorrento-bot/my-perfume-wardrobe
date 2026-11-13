// Production server: serves the built PWA from ./dist and the /api routes.

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync, existsSync } from 'node:fs';
import { Hono } from 'hono';
import { createApp } from './app';
import { providerFromEnv } from './ai';
import { loadDotEnv } from './env';

loadDotEnv();

const ai = providerFromEnv();
const api = createApp({ ai, rateLimit: Number(process.env.AI_RATE_LIMIT) || 40 });
const root = new Hono();

root.use('*', async (c, next) => {
  await next();
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
  c.header('permissions-policy', 'geolocation=(self), camera=(self)');
});

root.route('/', api);

if (!existsSync('./dist/index.html')) {
  console.error('dist/ not found — run "npm run build" first.');
  process.exit(1);
}
const indexHtml = readFileSync('./dist/index.html', 'utf8');

root.use(
  '/assets/*',
  serveStatic({
    root: './dist',
    onFound: (_p, c) => {
      c.header('cache-control', 'public, max-age=31536000, immutable');
    },
  }),
);
root.use('/sw.js', serveStatic({ root: './dist', onFound: (_p, c) => { c.header('cache-control', 'no-cache'); } }));
root.use('*', serveStatic({ root: './dist' }));
// SPA fallback for client-side routes.
root.get('*', (c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'not_found' }, 404) : c.html(indexHtml)));

const port = Number(process.env.PORT) || 8787;
serve({ fetch: root.fetch, port }, () => {
  console.log(`My Perfume Wardrobe on http://localhost:${port}  ·  AI: ${ai ? `${ai.id} (${ai.model})` : 'not configured'}`);
});
