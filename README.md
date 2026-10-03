# Signal

A full-screen, installable HIIT timer built around a simple visual signal: every phase paints the whole window its own color. It includes the Tuesday, Wednesday, and Friday schedules below, plus a workout builder that stores the complete custom workout in its URL.

## Preset workouts

Every preset is 47 minutes:

| Day | Warmup | Setup | Circuit | Cleanup |
| --- | --- | --- | --- | --- |
| Tuesday | 25 min run + stretch | 5 min | 3 rounds: bicep curls (15/20/20 lb), plank, triceps (5 lb), plank | 5 min |
| Wednesday | 25 min run + stretch | 5 min | 3 rounds: pullups, jump rope, pushups, V-sits | 5 min |
| Friday | 25 min run + stretch | 5 min | 3 rounds: front raise (10/15/15 lb), left side plank, lateral raise (10/15/15 lb), right side plank | 5 min |

Each circuit exercise uses 45 seconds of work followed by 15 seconds of rest, including the final exercise.

## Features

- Automatic phase, round, exercise, and rest transitions
- Drift-resistant timing based on monotonic elapsed time
- Audio countdown/transition cues and supported-device vibration
- Full-screen mode, focus mode, and screen wake lock as progressive enhancements
- Phase-colored queue rail, equipment checklist, and weight-change callouts
- Pause, resume, previous, next, restart, mute, and keyboard controls
- Responsive portrait and landscape timer layouts
- Offline-capable PWA with an installable manifest
- Validated custom workout editor with ordered phases and circuits
- Versioned, compressed custom workouts stored entirely in the URL fragment

Custom workout links do not require an account, backend, or browser storage. Bookmark or share the generated URL to keep a workout.

## Keyboard controls

| Key | Action |
| --- | --- |
| Space | Start, pause, or resume |
| Left arrow | Previous interval |
| Right arrow | Next interval |
| `M` | Toggle sound and vibration cues |
| `F` | Toggle focus mode (hide the queue rail) |

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
