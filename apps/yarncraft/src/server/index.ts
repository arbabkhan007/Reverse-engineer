import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, '../../dist');
const port = Number(process.env.PORT ?? 4173);

const app = createApp({ staticDir });

app.listen(port, '0.0.0.0', () => {
  console.log(`YarnCraft Studio listening on http://0.0.0.0:${port}`);
});
