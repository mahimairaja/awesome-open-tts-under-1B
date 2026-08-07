# site

Astro build for the filterable view of `../README.md`.

**To add or change a model, edit `../README.md`. Nothing here needs touching.**

```bash
npm install
npm run check    # does ../README.md still parse cleanly?
npm run dev      # http://localhost:4321/
npm run build
```

## How it works

`src/lib/parse-readme.js` reads the two markdown tables out of `../README.md` at
build time and derives every filter facet from the prose cells. There is no
database and no duplicated model data.

The parser is deliberately conservative: anything it cannot read confidently
becomes `unknown` and the row still renders with its full prose. Three rules it
encodes, each from a real case in the list:

- **Params.** Byte units are rejected, so `not published (87.4 MB TorchScript...)`
  reports no parameter count rather than 87.4M.
- **License.** The cell is scanned left to right and the first licence wins,
  because the list states the licence on the *weights* first and any code or
  codec licence after it. `MIT (HF card only; the GitHub repo ships no LICENSE
  file)` is MIT, not unstated.
- **Restricted table.** A row there can never render as permissive. If the prose
  parses that way the classifier misread it, so the build warns and falls back to
  "check cell".

`npm run check` exits non-zero on a malformed row, a missing table, or a
restricted row that parsed as permissive. CI runs it before every deploy.

## Deploy

`.github/workflows/deploy.yml` publishes to GitHub Pages on any push to `main`
that touches `README.md` or `site/`. Enable it once under
**Settings → Pages → Source → GitHub Actions**.
