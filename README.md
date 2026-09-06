# Rushline

A browser-native **3D precision time-trial racer** inspired by Trackmania. Chase medals, beat your ghost, and stick loops on three hand-built tracks — playable on desktop and mobile.

**Live stack:** React 19 · TanStack Start · Three.js r185 · Zustand · Tailwind v4 · Web Audio

## Tracks

| Track | Vibe | Length | Signature |
| --- | --- | --- | --- |
| **Green Circuit** | Stadium day | ~1064 m | Banked stadium oval, boost pads, tight chicane |
| **Ridge Drop** | Canyon dusk | ~1213 m | Long downhill, jump, cliff walls |
| **Helix Night** | Neon city | ~727 m | Full loop, sticky-track helix, night lights |

Each track has author / gold / silver / bronze medal times, checkpoints, boost pads, and a personal-best ghost.

## Controls

### Desktop
| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Steer | A / D or ← / → | Left stick / d-pad |
| Accelerate | W or ↑ | RT / A |
| Brake / reverse | S or ↓ | LT / B |
| Slide | Space | LB / X |
| Respawn | R | Y |
| Camera | C | — |
| Pause | Esc | Start |

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
