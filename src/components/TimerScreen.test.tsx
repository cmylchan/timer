import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workout } from '../types/workout'
import { TimerScreen } from './TimerScreen'

const workout: Workout = {
  id: 'quick',
  name: 'Quick test',
  blocks: [
    {
      id: 'warmup',
      type: 'phase',
      name: 'Get ready',
      durationSeconds: 10,
      tone: 'warmup',
    },
  ],
}

describe('TimerScreen', () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    })
  })

  it('renders the ready state and can pause after starting', async () => {
    const user = userEvent.setup()
    render(<TimerScreen workout={workout} onExit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Get ready' })).toBeVisible()
    expect(screen.getByText('0:10')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Turn cues off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Pause workout' }))

    expect(screen.getByRole('status')).toHaveTextContent('Paused')
    expect(
      screen.getByRole('button', { name: 'Resume workout' }),
    ).toBeVisible()
  })

  it('shows the next exercise side or weight cue during rest', async () => {
    const user = userEvent.setup()
    const cueWorkout: Workout = {
      id: 'cue-test',
      name: 'Cue test',
      blocks: [
        {
          id: 'circuit',
          type: 'circuit',
          name: 'Circuit',
          rounds: 1,
          workSeconds: 10,
          restSeconds: 5,
          exercises: [
            {
              id: 'front-raise',
              name: 'Front raise',
              roundCues: ['10 lb'],
            },
            {
              id: 'side-plank',
              name: 'Side plank',
              roundCues: ['Right'],
            },
            {
              id: 'lateral-raise',
              name: 'Lateral raise',
              roundCues: ['15 lb'],
            },
          ],
        },
      ],
    }

    render(<TimerScreen workout={cueWorkout} onExit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Turn cues off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Next interval' }))

    expect(screen.getByText('Next: Right side plank')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Next interval' }))
    await user.click(screen.getByRole('button', { name: 'Next interval' }))

    expect(screen.getByText('Next: Lateral raise · 15 lb')).toBeVisible()
  })
})
