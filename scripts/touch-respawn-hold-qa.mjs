#!/usr/bin/env node
/**
 * CDP touch repro: hold RespawnRestartButton ≥550ms then release must not applyRespawn.
 * Requires dev server on 127.0.0.1:8080 (npm run dev).
 */
import { chromium } from "playwright";

const url = process.env.TOUCH_QA_URL ?? "http://127.0.0.1:8080/";
const holdMs = Number(process.env.TOUCH_QA_HOLD_MS ?? 3000);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("canvas", { timeout: 90_000 });
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: /all tracks|tracks/i }).click({ timeout: 15_000 });
  await page.locator('[data-track="helix"]').click({ timeout: 15_000 });

  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return /\b3\b/.test(t) || /\b2\b/.test(t) || /\b1\b/.test(t) || /CP\s+0\//i.test(t);
    },
    { timeout: 30_000 },
  );
  await page.waitForTimeout(3500);

  const btn = page.getByRole("button", { name: /respawn/i });
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  const box = await btn.boundingBox();
  if (!box) throw new Error("respawn button has no layout box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.evaluate(() => {
    window.__rushlinePlaytest = { marks: [] };
  });

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, radiusX: 1, radiusY: 1, force: 1, id: 0 }],
  });
  await page.waitForTimeout(holdMs);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(800);

  const result = await page.evaluate(() => {
    const marks = window.__rushlinePlaytest?.marks ?? [];
    const text = document.body.innerText;
    const sawCountdown = /\b3\b|\b2\b|\b1\b/.test(text);
    return { marks, sawCountdown, excerpt: text.slice(0, 400) };
  });

  await browser.close();

  const restarts = result.marks.filter((m) => m === "restartRun").length;
  const respawns = result.marks.filter((m) => m === "applyRespawn").length;
  const blocked = result.marks.filter((m) => m === "respawnBlocked").length;
  const ok = restarts === 1 && respawns === 0;

  console.log(
    JSON.stringify(
      {
        ok,
        restarts,
        respawns,
        respawnBlocked: blocked,
        marks: result.marks,
        holdMs,
        note: ok
          ? "hold restart only; no applyRespawn on release"
          : "expected exactly one restartRun and zero applyRespawn",
      },
      null,
      2,
    ),
  );
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2));
  process.exit(1);
});
