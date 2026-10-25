/**
 * Dev server: one port serving both the API and the Vite client.
 *
 * Vite runs in middleware mode and its HMR websocket is attached to the same
 * HTTP server, so there is exactly one listening port and the preview needs no
 * proxy or second origin.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { registerApiRoutes, registerErrorHandler } from './app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const port = Number(process.env.PORT ?? 5180);

const app = express();
app.use(express.json({ limit: '6mb' }));
app.disable('x-powered-by');
registerApiRoutes(app);

const httpServer = createServer(app);

const vite = await createViteServer({
  root,
  appType: 'custom',
  server: {
    middlewareMode: true,
    hmr: { server: httpServer },
    allowedHosts: true,
  },
});

app.use(vite.middlewares);

// SPA fallback: let Vite transform the shell for any non-API GET.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    next();
    return;
  }
  const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>YarnCraft Studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>`;
  vite
    .transformIndexHtml(req.originalUrl, template)
    .then((html) => {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    })
    .catch(next);
});

registerErrorHandler(app);

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`YarnCraft dev server on http://0.0.0.0:${port}`);
});
