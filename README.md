# Rushline

A browser-native **3D precision time-trial racer** inspired by Trackmania. Chase medals, beat your ghost, and stick loops on seven hand-built tracks — or run **Rush Cup**. Desktop, touch, and gamepad.

**Live stack:** React 19 · TanStack Start · Three.js r185 · Zustand · Tailwind v4 · Web Audio

## Play

**Time trial** — pick any circuit, hunt Author / Gold / Silver / Bronze, and race your personal-best ghost.

**Rush Cup** — a short local campaign. Clear **Gold** (or better) on all seven tracks in order, then **Author Cup** unlocks on the same seven. Finishing an event unlocks the next challenge; results offer **Next challenge**. Progress lives in `localStorage` under `rushline-cup-v1` — no account.

Help (menu, pause, or Settings) opens the in-game controls sheet. It lists the keyboard, touch, and gamepad bindings that are actually live.

**Rewind** — hold **Backspace** or **LB + Y** to scrub the last few seconds of the run. The race clock and ghost compare walk backward with you. Rewind is allowed in time trial and Rush Cup; it does not wipe a standing personal best — only a finish after rewind can replace it. Toggle **Enable Rewind** in Settings (on by default on desktop).

**R** (or **Y**) returns you to the last checkpoint — Trackmania-style. Hold **R** / **Y**, or press **Delete**, to restart the whole run from lights-out. **C** cycles Chase → Far → Hood → Cabin; all four stay usable at speed. Settings has a Slow / Normal / Fast steering preset for keyboard and pad (Track Assist scales are unchanged).

## Tracks

| Track | Vibe | Length | Signature |
| --- | --- | --- | --- |
| **Green Circuit** | Stadium plastic | ~1064 m | Banked stadium oval, boost pads, tight chicane · 2 laps |
| **Ridge Drop** | Canyon dirt | ~1213 m | Paved start, dirt canyon, downhill jump |
| **Night Helix** | Night tech | ~727 m | Full loop, sticky metal helix, night lights |
| **White Pass** | Alpine ice | ~948 m | Switchbacks, packed ice, long descent |
| **Arc Yard** | Works tech | ~952 m | Metal docks, gantry climb, freight drop |
| **Red Mesa** | Desert dirt | ~1118 m | Dirt climb, plastic table, dirt edge drop |
| **Black Hollow** | Forest dirt | ~819 m | Moonlit dirt pines, then a tech clearing sprint |
| **Custom** | Your ribbon | editor | Closed Catmull-Rom loop you place yourself |

Each stock track has author / gold / silver / bronze times, checkpoints, boost pads, and a personal-best ghost. **Custom** lives at the bottom of Tracks — **Edit ribbon** opens a lite editor (control points, height / width / bank, checkpoint and boost flags). Save stays on this device (`rushline-custom-v1`); Export / Import is JSON. Drive it in time trial. Rush Cup stays the stock seven.

**Surfaces** change how the car grips. Plastic (Circuit, Mesa table) is the stadium baseline — slide-friendly but readable. Dirt (Ridge, Mesa climb/drop, Hollow pines) enters a slide earlier and pulls accel. Ice (White Pass) is the slipperiest: weak brakes, early slide, a high hiss. Tech (Helix, Yard, Hollow clearing) sticks later and stops harder. The HUD chip names the ribbon under the car.

Each stock circuit ships a lightweight **author ghost** paced to the Author medal, so a first-time run always has a rival. A personal-best ghost is saved with the time and replaces it. If that ghost is missing or too thin, the last finished run is used instead. An imported rival also replaces the author line. Results can **Retry vs last run** to race that lap even when a stronger PB ghost exists. Best / last / medal times sit on each track card.

**Ghost share** — export a last-run or PB tape as a JSON file from Results or Tracks, then import a friend's file to race that circuit as a rival. Sharing is local only (download / pick a file). A rival never overwrites your PB, last run, Rush Cup, or Garage paint. Clear it from Tracks when you want the usual ghost back. Files live in `localStorage` under `rushline-ghost-share-v1`.

## Garage

Six liveries: **Ivory**, **Violet**, **Sun**, **Frost**, **Carbon**, **Hazard**. Pick one from the menu; the car on track updates live. Paint is cosmetic and persists in `rushline-v1` and `rushline-settings-v1`.

## Photo mode

Freeze a still with the HUD hidden.

- Open from the camera button, Pause, Results, **F**, or **LB + View**
- Drag or WASD to orbit; **Q / E** (or − / =) zoom; wheel zooms on desktop
- **Enter** or **Capture still** saves a PNG
- **C** resets the orbit; **F** or **Esc** exits
- After a finish you can follow the ghost and scrub the replay

## Audio

Web Audio engine note, tire scrape, countdown / medal stingers, and a ducked menu bed. Settings expose **Master**, **SFX**, and **Music**, plus mute from the menu, HUD, or Options. First tap unlocks the graph; `?mute=1` starts silent.

## Controls

### Desktop

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Steer | A / D or ← / → | Left stick / D-pad |
| Accelerate | W or ↑ | RT / R2 / A |
| Brake / reverse | S or ↓ | LT / L2 / B |
| Slide | Space or Shift | LB / L1 / X |
| Respawn (last checkpoint) | R | Y / Triangle |
| Restart run | Hold R or Delete | Hold Y / Triangle |
| Rewind | Hold Backspace | LB + Y |
| Cycle camera (Chase → Far → Hood → Cabin) | C | View / Share / RB |
| Photo mode | F | LB + View |
| Pause | Esc or P | Menu / Start / Options |

Menus: **Enter** confirms, **Backspace** goes back, **W / S** or the D-pad moves the selection. **A** starts from the title; **B** returns.

Stick and triggers use an inner deadzone (16% stick, 8% trigger) so a resting pad does not steal keyboard or touch. Hot-plug is live: connecting a pad shows an on-screen hint. Compatible pads rumble on boost, crash, turbo, land, and finish. Keyboard, touch, and Track Assist stay unchanged.

### Mobile

- **Left pad** — steer (sensitivity and invert live in Settings)
- **Right cluster** — accel / brake / slide; brake wins if both are held
- **Respawn** above the cluster — tap for last checkpoint, hold to restart; **Pause** top-left
- If **Enable Rewind** is on, hold the Rewind button next to Respawn (a tap does nothing)
- Auto-throttle is on by default on touch; Track Assist can pin you to the racing line
- Photo mode hides the pads so orbit drag and Capture stay clean

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (Vite serves on port 8080).

```bash
npm run build      # production bundle
npm run typecheck  # tsc --noEmit
```

No database or auth required. Personal-best times and ghosts persist in `localStorage` under `rushline-v1`. Garage liveries persist there too, and in `rushline-settings-v1`. Cup campaign progress is stored separately in `rushline-cup-v1`. Imported rival ghosts use `rushline-ghost-share-v1`. A custom ribbon lives in `rushline-custom-v1`.

## Project map

```
src/game/            # simulation + rendering (pure Three.js, no R3F)
  Game.ts            # rAF loop, phases, HUD wiring
  track.ts           # Catmull-Rom spline, parallel transport, mesh build
  editor.ts          # Custom ribbon save / control points / validation
  physics.ts         # grounded / airborne car, walls, boost, checkpoints
  scene.ts           # world, car mesh, camera, particles, environment
  input.ts           # keyboard + injected touch / gamepad actions
  gamepad.ts         # Standard mapping, deadzone, rumble
  help.ts            # in-game controls sheet (source of truth for bindings copy)
  ghost-share.ts     # TM-style ghost JSON export / import
  cup.ts             # Rush Cup campaign
  photo.ts           # photo orbit / still export
  store.ts           # zustand phase / HUD / save
  audio.ts           # Web Audio engine + stingers
src/components/game/
  Rushline.tsx       # canvas host
  Overlay.tsx        # menu, HUD, results, pause, help
  SettingsPanel.tsx  # graphics / audio / camera / assists
  TouchPad.tsx       # mobile controls
  overlay/           # menu, cup, editor, help, photo, results
public/textures/     # skyboxes + track thumbnails
```

## License

Personal project. Trackmania is a trademark of Ubisoft / Nadeo — this is an independent fan-style racer, not affiliated with either.
