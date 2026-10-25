# Crochet Studio integration patch

`0001-crochet-studio.patch` adds the web companion to **arbabkhan007/Crochet-Pattern-Checker**.
The app was built here (in `apps/yarncraft`) because this is the repository this session could
push to; this patch is the portable form for the Python repo.

## Apply it

```bash
cd /workspaces/Crochet-Pattern-Checker
git checkout main && git pull
git checkout -b feat/crochet-studio
git fetch https://github.com/arbabkhan007/Reverse-engineer.git arena/d54a79c0-reverse-engineer
git show FETCH_HEAD:integrations/crochet-pattern-checker/0001-crochet-studio.patch > /tmp/crochet-studio.patch
git am /tmp/crochet-studio.patch
```

If `git fetch` asks for credentials, run `gh auth setup-git` first, or download the raw file:

```bash
curl -L -o /tmp/crochet-studio.patch \
  https://raw.githubusercontent.com/arbabkhan007/Reverse-engineer/arena/d54a79c0-reverse-engineer/integrations/crochet-pattern-checker/0001-crochet-studio.patch
```

## Then build and run

```bash
cd web/studio && npm install && STUDIO_BASE=/studio/ npm run build && cd ../..
pip install -e ".[dev]"
uvicorn crochet_checker.web.app:app --host 0.0.0.0 --port 8000
```

Open the forwarded port 8000 and go to `/studio/`. The original checker UI at `/` is unchanged.

## What the patch touches

| Path | Change |
| --- | --- |
| `web/studio/**` | new: the React/TypeScript companion (48 files) |
| `src/crochet_checker/web/app.py` | mount `web/studio/dist` at `/studio` when it exists; add `POST /api/import/url` |
| `src/crochet_checker/web/import_url.py` | new: SSRF-guarded page fetch and HTML-to-text |
| `tests/test_import_url.py` | new: 36 tests, mostly guard refusals and fetch limits |
| `.gitignore` | ignore the module's `node_modules/` and `dist/`; re-include `src/client/lib/` |
| `README.md` | a short "Web companion" section |

Verified against a fresh clone of `main`: patch applies, `npm run build` succeeds, `/studio` mounts,
`POST /api/check` responds, `POST /api/import/url` refuses private targets, and the suite reports
**281 passed** (245 existing + 36 new), and the studio's own **60 tests** pass.

### Features in the studio

Pattern library (526 patterns), stitch-maths checker, PDF and web import, row counter with making
time, photo texture aid, pattern canvas, five courses, **US/UK dialect translator with a count-safety
check**, **gauge and sizing calculator**, **image-to-chart converter**, **hands-free read-aloud**, and
a print stylesheet.

### Why `/api/import/url` is included

The studio's web converter posts to `/api/import/url`. Mounted under FastAPI that endpoint did not
exist, so the feature was broken in the deployment this README describes. It is now served by Python
with an SSRF guard: scheme allowlist, DNS resolution with private/loopback/link-local/reserved
refusal, re-validation on every redirect hop, and caps on redirects, bytes and time. It returns text
only - `/api/check` still decides whether that text is a valid pattern.
