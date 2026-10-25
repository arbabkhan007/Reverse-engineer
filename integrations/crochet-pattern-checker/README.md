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
| `src/crochet_checker/web/app.py` | mount `web/studio/dist` at `/studio` when it exists |
| `.gitignore` | ignore the module's `node_modules/` and `dist/`; re-include `src/client/lib/` |
| `README.md` | a short "Web companion" section |

Verified against a fresh clone of `main`: patch applies, `npm run build` succeeds, `/studio` mounts,
`POST /api/check` responds, and the repository's own `pytest` suite still reports 245 passed.
