# Rushline

A browser-native **3D precision time-trial racer** inspired by Trackmania. Chase medals, beat your ghost, and stick loops on five hand-built tracks — playable on desktop and mobile.

**Live stack:** React 19 · TanStack Start · Three.js r185 · Zustand · Tailwind v4 · Web Audio

## Tracks

| Track | Vibe | Length | Signature |
| --- | --- | --- | --- |
| **Green Circuit** | Stadium day | ~1064 m | Banked stadium oval, boost pads, tight chicane |
| **Ridge Drop** | Canyon dusk | ~1213 m | Long downhill, jump, cliff walls |
| **Helix Night** | Neon city | ~727 m | Full loop, sticky-track helix, night lights |
| **White Pass** | Alpine morning | ~948 m | Switchbacks, packed ice, long descent |
| **Arc Yard** | Industrial twilight | ~952 m | Tight dock cuts, gantry climb, freight drop |

Each track has author / gold / silver / bronze medal times, checkpoints, boost pads, and a personal-best ghost.

## Controls

### Desktop
| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Steer | A / D or ← / → | Left stick / D-pad |
| Accelerate | W or ↑ | RT / R2 / A |
| Brake / reverse | S or ↓ | LT / L2 / B |
| Slide | Space or Shift | LB / L1 / X |
| Respawn | R | Y / Triangle |
| Camera | C | View / Share / RB |
| Pause | Esc or P | Menu / Start / Options |

Stick and triggers use an inner deadzone (16% stick, 8% trigger) so a resting pad does not steal keyboard or touch. Hot-plug is live: connecting a pad shows an on-screen hint; keyboard, touch, and Track Assist stay unchanged.

A personal-best ghost is saved with the time. If that ghost is missing or too thin, the last finished run is used instead. Results can **Retry vs last run** to race that lap even when a stronger PB ghost exists. Best / last / medal times sit on each track card.

### Mobile
- **Left pad** — steer
- **Right buttons** — accel / brake / slide / respawn
- Auto-throttle is on by default on touch devices

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

No database or auth required. Personal-best times and ghosts persist in `localStorage` under `rushline-v1`.

## Project map

```
src/game/            # simulation + rendering (pure Three.js, no R3F)
  Game.ts            # rAF loop, phases, HUD wiring
  track.ts           # Catmull-Rom spline, parallel transport, mesh build
  physics.ts         # grounded / airborne car, walls, boost, checkpoints
  scene.ts           # world, car mesh, camera, particles, environment
  input.ts           # keyboard + injected touch / gamepad actions
  store.ts           # zustand phase / HUD / save
  audio.ts           # Web Audio engine + stingers
src/components/game/
  Rushline.tsx       # canvas host
  Overlay.tsx        # menu, HUD, results, pause
  TouchPad.tsx       # mobile controls
public/textures/     # skyboxes + track thumbnails
```

## License

Personal project. Trackmania is a trademark of Ubisoft / Nadeo — this is an independent fan-style racer, not affiliated with either.
