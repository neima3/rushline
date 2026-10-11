# Site identity (`src/lib/og/site.json`)

Set at least `title`, `"card": "custom"`, and for games `"type": "x:game"`.
Write via atomic hand-over:

```bash
node scripts/write-atomic.mjs /workspace/.grok/site.json.tmp src/lib/og/site.json
```
