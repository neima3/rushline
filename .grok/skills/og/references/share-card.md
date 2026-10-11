# Share card (1200×630)

Encode as JPEG and hand over atomically:

```bash
node scripts/write-atomic.mjs /workspace/.grok/og.jpg.tmp public/og.jpg
```

Stage the temp under `/workspace/.grok/` — never write `public/og.jpg.tmp`
(vite ships `public/` verbatim).
