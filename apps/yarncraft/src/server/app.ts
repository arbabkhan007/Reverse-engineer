import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { ImportError, importPatternFromUrl } from './urlImport.ts';

/** Registers the JSON API. Kept separate so dev and production compose it differently. */
export function registerApiRoutes(app: Express): void {
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'yarncraft', version: '1.0.0' });
  });

  app.post('/api/import/url', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!url) {
        res.status(400).json({ error: 'A url is required.' });
        return;
      }
      const result = await importPatternFromUrl(url);
      res.json(result);
    } catch (error) {
      if (error instanceof ImportError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  });
}

export function registerErrorHandler(app: Express): void {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(500).json({ error: message });
  });
}

export interface AppOptions {
  /** Directory holding the built client (production only). */
  staticDir?: string;
  /** Middleware inserted after the API and before static hosting (Vite in dev). */
  middlewares?: express.RequestHandler[];
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.disable('x-powered-by');

  registerApiRoutes(app);

  for (const middleware of options.middlewares ?? []) app.use(middleware);

  if (options.staticDir) {
    app.use(express.static(options.staticDir, { index: false, maxAge: '1h' }));
    // Single-page app: every other GET returns the client shell.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile('index.html', { root: options.staticDir! });
    });
  }

  registerErrorHandler(app);
  return app;
}
