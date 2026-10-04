# Signal

A full-screen, installable HIIT timer built around a simple visual signal: every phase paints the whole window its own color, so you can tell where you are in a workout from across the room.

| Phase | Color |
| --- | --- |
| Warm-up | Char `#1A0A05` |
| Setup and cleanup | Flash `#FFD23F` |
| Work | Heat `#FF4D2E` |
| Rest and recovery | Cobalt `#2337E8` |

## Starting workouts

On first launch, Signal saves three 47-minute workouts on this laptop:

| Workout | Warm-up | Setup | Circuit, 3 rounds of 45s / 15s | Cleanup |
| --- | --- | --- | --- | --- |
| Tuesday arms | 25 min | 5 min | Bicep curls (15, 20, 20 lb), plank, tricep extension (5 lb), plank | 5 min |
| Wednesday bodyweight | 25 min | 5 min | Pull-ups, jump rope, push-ups, V-sits | 5 min |
| Friday shoulders | 25 min | 5 min | Front raise (10, 15, 15 lb), side plank left, lateral raise (10, 15, 15 lb), side plank right | 5 min |

## Features

- Phase-colored timer with a queue rail that previews what's next
- Weight badges, a setup checklist built from the workout's weights, and a callout when a weight changes between rounds
- Spoken callouts: each interval is named as it starts, rests say what's next and which weight to grab, and long blocks give a heads-up 10 seconds before they end
- Three short beeps before every phase change, pitched differently for work and rest
- Type that scales with the window, at the same sizes in every phase
- Timing computed from timestamps, so background tabs don't drift
- Screen wake lock while a workout runs, and a title bar that takes the phase color in the installed app
- Workout editor with timed blocks and circuits, per-round weights, circuit or sets order, and drag-to-reorder
- Run history: completed and stopped runs, shown on the home screen

Workouts and run history are stored in IndexedDB on this device. Fonts and assets are cached by the service worker, so the app works offline.

## Keyboard

| Key | Action |
| --- | --- |
| Space | Pause and resume |
| → | Next interval, or next block during long blocks |
| ← | Restart the current interval; press twice for the previous one |
| `F` | Focus mode: hide the queue rail |
| `M` | Mute cues |
| Esc | End the workout, with confirmation; the workout pauses while you decide |

## Development

The repository uses the Node version in `.tool-versions`.

```sh
npm install
npm run dev
```

Validation commands:

```sh
npm run lint
npm test
npm run build
```

The production build is written to `dist/`. Preview it locally with `npm run preview`.
