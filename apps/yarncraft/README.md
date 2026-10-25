# YarnCraft Studio

An original crochet and knitting companion: pattern library, stitch-maths checker, PDF and web
converter, row counter, photo stitch identification, and a pattern canvas.

This app lives at `web/studio/` and is mounted by the repository's FastAPI app at `/studio`.

**The Python engine in `src/crochet_checker/` remains the authoritative checker.** The studio calls
`POST /api/check` and displays that result; it does not replace or reimplement validation. The score
shown at the top of the studio's checker page is a browser-side pre-check, and the UI says so.

## Why this exists

The feature set was derived from a public analysis of the YarnPal app (Google Play, `com.yarnpal.ai`,
PIXELCELL PTE. LIMITED): its store listing documents step-by-step courses, video tutorials, a 500+
pattern library, project progress tracking, stitch identification from a photo, a pattern designer,
and a PDF/web pattern converter.

**No YarnPal code, assets, or decompiled material is used or reproduced here.** YarnPal is
closed-source proprietary software. Everything in this directory is written from scratch from the
publicly described feature set, and the implementation makes different, verifiable choices - most
notably a real stitch-mathematics engine rather than a scroll-and-count UI, and honest confidence
reporting instead of confident-sounding guesses.

## What it does

| Feature | Implementation |
| --- | --- |
| **Pattern library** | 526 patterns across 10 categories and 4 skill levels, with seasonal collections, ten-minute makes, and weekly rotating picks. Every pattern's instructions are generated from a shape spec and re-verified by the checker. |
| **Pattern checker** | Parses written patterns (paste, PDF, web) into steps and verifies every stated stitch count against what the instructions actually make. Reports errors with the exact row and a suggested fix. |
| **PDF converter** | Reads PDF text in the browser with `pdfjs-dist`, reconstructing lines from positioned text items. Detects scanned pages instead of silently returning nothing. |
| **Web converter** | Server-side fetch behind an SSRF guard (private ranges, DNS rebinding, redirect and size limits), HTML cleaned of navigation, adverts and footers. |
| **Row counter** | Per-project step ticks, stitch counter, repeat counter, making-time tracker, notes. Debounced persistence to local storage. |
| **Stitch identification** | Deterministic texture analysis: Sobel edge density, gradient orientation, and autocorrelation-derived stitch width and row height, scored against construction-based stitch profiles. Optional vision-model provider for a second opinion. |
| **Pattern canvas** | Paint a stitch grid, get written instructions that the checker verifies, then save it as a pattern or a project. |
| **Courses** | Five progressive courses, 19 lessons, from hook hold to blocking, with tips and stitch diagrams. |
| **US / UK translator** | Rewrites a pattern between dialects in a single pass, then verifies that **no stitch count changed**. Each UK name is one step taller than its US counterpart. |
| **Gauge & sizing** | Swatch to stitch/row counts, repeat rounding, flat-circle plans, and rescaling an existing pattern when your tension differs. |
| **Image to chart** | Upload an image, get a reduced palette, a stitch grid and written colourwork rows whose numbers always sum to the chart width. |
| **Read aloud** | Hands-free row reading with the browser's speech engine, one row at a time, with adjustable speed. |
| **Print sheet** | A print stylesheet strips navigation and controls so any pattern prints as a clean working copy. |
| **Yarn stash & planner** | Price a pattern from your own gauge, see how many skeins that means, and get told when the waste allowance is what pushes you over a skein boundary. Stash tracks length, weight and value. |
| **Symbol charts** | Written rows become standard chart symbols, one cell per stitch, with repeat boundaries marked. Cells are weighted by how many stitches they make, so an increase is one cell worth two. |
| **Journal** | Notes, measurements and progress photos per project, grouped by day. Photos are downscaled and evicted oldest-first before the storage quota is reached — and the page says when that happens. |
| **Command palette** | Ctrl/⌘+K over every tool, all 526 patterns and every lesson. Word order doesn't matter and keyword-only matches never outrank a name. |
| **Offline** | A service worker caches the app shell, so the studio opens with no signal. API calls are never cached: the Python checker is the authority and a stale verdict would be worse than none. |
| **Optional AI** | Pluggable: offline (default), OpenAI, Anthropic, or an OpenAI-compatible gateway. Keys stay in the browser and are sent only to the provider you choose. |
| **Backup** | Full state export/import as JSON. Everything is local-first; there is no account and no server database. |

## Architecture

```
apps/yarncraft/
├── src/
│   ├── shared/types.ts        data contracts only, imported by every layer
│   ├── domain/                pure engines, no I/O, fully unit tested
│   │   ├── patternChecker.ts  tokeniser + stitch-maths evaluator
│   │   ├── patternParser.ts   raw text -> steps + diagnostics
│   │   ├── patternGenerator.ts shapes and canvas -> written instructions
│   │   ├── stitchAnalyzer.ts  image features -> ranked stitch candidates
│   │   ├── stitches.ts        the single owner of stitch identity
│   │   ├── catalog.ts         526-pattern library
│   │   ├── courses.ts         curriculum
│   │   └── checkerSummary.ts  report aggregation and formatting
│   ├── server/                Express: static hosting, URL import, dev composition
│   └── client/                React: store, router, pages, components
└── src/tests/                 domain and server tests (vitest)
```

Dependencies flow inward: `shared` ← `domain` ← `server`/`client`. The domain layer performs no
network or filesystem access, which is what makes it directly testable and lets the same engine run
in the browser and in Node.

### The checker, specifically

The stitch-maths engine is the part that has to be right, so it is conservative by design:

- **Interprets** stitch words, counts (`2 sc`, `ch 31`), bracket groups (`(sc, inc) x 6`), star
  repeats (`*sc, inc* rep 6 times`), decreases (`sc2tog`, `dec`), increases (`inc`), and turning chains.
- **Distinguishes** a foundation chain from a working row, so `ch 1, turn, sc in each st across`
  counts stitches, not chains.
- **Threads the previous row's count** through, so distributive wording ("in each st across") resolves
  correctly and is labelled as an *assumption* rather than presented as fact.
- **Reports** anything it cannot interpret as an unparsed fragment, with the text quoted. It never
  silently counts an unknown word as zero.

Verification result over the whole shipped library:

```
patterns 526 | count errors 0 | crashes 0
rows generated 7036 | rows whose stated count was verified 6965
```

Dependency audit: **0 vulnerabilities** (Vite 8, Vitest 5, React 18).

Studio tests: **117 passing**, covering the checker, generators, texture analysis, web import,
dialect translation (round-trip and count-preservation), gauge maths, image charting, stitch
tokenizing, yarn estimation, skein planning, symbol charts, journal budgets and palette ranking.

The stitch tokenizer is tested *against* the maths engine, not just on its own: `[sc, inc] x 6`
has to yield 12 cells and 18 stitches, which is the same 18 the engine computes. Where a row
cannot be fully charted (distributive wording such as "sc in each st across"), the chart reports
"partly placed" rather than claiming agreement or disagreement.

## Running it

Standalone development (client and its own API on one port):

Requires **Node 20.19 or newer** (Vite 8). The package declares this in `engines`.

```bash
cd web/studio
npm install
npm run dev        # http://localhost:5180
```

Served by the FastAPI app, alongside the Python checker:

```bash
cd web/studio && npm run build          # bundle in web/studio/dist
STUDIO_BASE=/studio/ npm run build      # bundle with sub-path asset URLs
cd .. && cd .. && uvicorn crochet_checker.web.app:app --port 8000
# open http://localhost:8000/studio/
```

Checks:

```bash
npm test           # 28 domain and server tests
npm run typecheck
npm run build
```

The dev server attaches Vite's HMR websocket to the same HTTP server, so there is a single listening
port and no proxy configuration.

## Honest limits

- **Stitch identification is a hint, not an answer.** It measures texture, so lighting, yarn halo,
  gauge and camera angle all shift the result. Every result shows its measurements and a confidence
  that is bounded well below certainty. The optional vision model is generally better at patterned
  fabric; the offline path is better at saying when it does not know.
- **Scanned PDFs are not OCR'd.** The converter says so explicitly and points at the alternatives.
- **Yarn estimates are rough.** They assume worsted weight and standard tension, and say so.
- **No video tutorials.** The original app's video content is proprietary and cannot be reproduced;
  the courses use written steps, stitch diagrams, worked examples and common-mistake notes instead.
- **Data lives in one browser.** There is no sync and no account. Use the backup export to move it.
