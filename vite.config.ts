import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Mounts the Hono API inside the Vite dev server: one process, same origin. */
function apiDevPlugin(): Plugin {
  let listener: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
  return {
    name: 'mpw-api-dev',
    configureServer(server) {
      server.watcher.on('change', (f) => {
        if (f.includes('/server/') || f.includes('/src/shared/')) listener = null;
      });
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          if (!listener) {
            const { createApp } = await server.ssrLoadModule('/server/app.ts');
            const { providerFromEnv } = await server.ssrLoadModule('/server/ai/index.ts');
            const { getRequestListener } = await import('@hono/node-server');
            const ai = providerFromEnv(process.env);
            server.config.logger.info(`  ➜  AI: ${ai ? `${ai.id} (${ai.model})` : 'not configured'}`);
            listener = getRequestListener(createApp({ ai, rateLimit: Number(process.env.AI_RATE_LIMIT) || 40 }).fetch);
          }
          listener(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-only variables (ANTHROPIC_API_KEY, …) available to the dev API.
  // Only VITE_* variables are ever exposed to client code, and we define none.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

  // BASE_PATH lets the same build run under a sub-path (GitHub Pages).
  const base = process.env.BASE_PATH || '/';

  return {
    base,
    plugins: [
      react(),
      apiDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['icons/favicon-32.png', 'icons/favicon-16.png', 'icons/apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'My Perfume Wardrobe',
          short_name: 'Wardrobe',
          description: 'Your personal fragrance playground: collect, spin, layer and discover.',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F6F3ED',
          theme_color: '#3155FF',
          categories: ['lifestyle', 'personalization'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Spin', short_name: 'Spin', url: 'spin', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Add perfume', short_name: 'Add', url: 'wardrobe/new', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [new RegExp(`^${base}api/`)],
          globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    server: { port: 5173, host: true },
    preview: { port: 4173 },
    build: { target: 'es2022', sourcemap: false },
  };
});
