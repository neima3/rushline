---
name: og
description: Brand-asset pass — custom share cards, PWA icons, og site.json, and x-banner for games and brand-forward apps.
---

# Open Graph / brand-asset pass

Games, canvas apps, and brand-forward pages must ship a **custom** 1200×630 share
card (`public/og.jpg`), explicit identity in `src/lib/og/site.json`, and (for
games) `public/x-banner.jpg` for X feed cards. Plain utilities may keep the
og.grok.me placeholder.

While generating, touch `/workspace/.grok/og-pending` so parent gates stay quiet;
remove it when finished. The marker goes stale after **10 minutes** — a stale
file must not excuse a missing card forever.

## Brand-asset pass:

Launch as a background task during scaffolding, not on the critical path before
first playable UI. Own `public/` brand assets and `src/lib/og/site.json`.

**No `wait_tasks`, never `get_task_output` on it** — the parent must not block
on the pass or consume the task output.

Before reporting done, self-check on disk (marker ignored):

```bash
node scripts/brand-check.mjs --game --root /workspace
```

For a plain utility that intentionally keeps the placeholder card:

```bash
node scripts/brand-check.mjs --placeholder-ok --root /workspace
```

Hand-over recipes (stage under `/workspace/.grok/`, never inside `public/`):

- Share card: see `references/share-card.md`
- X banner: see `references/x-banner.md`
- Site identity: see `references/site-json.md`

JPEG cards should stay under ~600 KB (ffmpeg `-q:v 4`, ~150–300 KB) so link
scrapers unfurl reliably.
