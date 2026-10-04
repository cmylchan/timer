import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import { cuePlayer } from '../lib/cues'
import { TimerScreen } from './TimerScreen'

const tuesday = createSeedWorkouts(0)[0]

function renderTimer() {
  const props = {
    workout: tuesday,
    onProgress: vi.fn(),
    onExit: vi.fn(),
    onRestart: vi.fn(),
  }
  render(<TimerScreen {...props} />)
  return props
}

function queueRows() {
  const rail = screen.getByRole('complementary', { name: 'Queue' })
  return within(rail).getAllByRole('listitem')
}

describe('TimerScreen', () => {
  it('starts running on open, with the warm-up block', () => {
    renderTimer()

    expect(screen.getByRole('heading', { name: 'Run / stretch' })).toBeVisible()
    expect(screen.getByText('Warm-up · block 1 of 4')).toBeVisible()
    expect(screen.getByRole('timer')).toHaveTextContent('25:00')
    expect(screen.getByRole('button', { name: 'Pause workout' })).toBeVisible()
    expect(queueRows().map((row) => row.textContent)).toEqual([
      'Setup5:00',
      'Circuit12:00',
      'Cleanup5:00',
    ])
  })

  it('keeps the remaining time on one line', () => {
    renderTimer()
    const rail = screen.getByRole('complementary', { name: 'Queue' })

    expect(within(rail).getByText('47:00', { selector: '.sr-only' })).toBeVisible()
    expect(rail.querySelector('.rail-remaining-time .digits')).toHaveTextContent('47:00')
  })

  it('pauses and resumes with the space bar', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard(' ')
    expect(screen.getByText('Paused')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeVisible()

    await user.keyboard(' ')
    expect(screen.queryByText('Paused')).toBeNull()
  })

  it('shows the exercise and weight, then what is next during rest', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByText('Round 1 of 3 · exercise 1 of 4')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Bicep curls' })).toBeVisible()
    expect(screen.getByText('15 lb', { selector: '.weight-badge' })).toBeVisible()
    expect(queueRows()[0]).toHaveAttribute('data-highlighted', 'true')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('heading', { name: 'Rest' })).toBeVisible()
    expect(screen.getByText('Next: plank')).toBeVisible()
    expect(screen.queryByText(/^Grab/)).toBeNull()
  })

  it('calls out a weight change at the end of a round', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard('{ArrowRight}'.repeat(9))
    expect(screen.getByText('End of round 1')).toBeVisible()
    expect(screen.getByText('Next: bicep curls')).toBeVisible()
    expect(screen.getByText('Grab 20 lb')).toBeVisible()
  })

  it('restarts the interval on ←, and goes back on a second press', async () => {
    const user = userEvent.setup()
    renderTimer()
    await user.keyboard('{ArrowRight}{ArrowRight}')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('heading', { name: 'Bicep curls' })).toBeVisible()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('Setup · block 2 of 4')).toBeVisible()
    expect(screen.getByRole('button', { name: '5 lb dumbbells' })).toBeVisible()
  })

  it('toggles focus mode and mute, ignoring modified keys', async () => {
    const user = userEvent.setup()
    renderTimer()
    const mute = screen.getByRole('button', { name: 'Mute cues' })

    await user.keyboard('{Meta>}m{/Meta}')
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    await user.keyboard('m')
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('f')
    expect(screen.getByRole('button', { name: 'Focus mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('beeps three times before each phase change, pitched for what is next', () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'],
    })
    const beep = vi.spyOn(cuePlayer, 'playCountdown').mockResolvedValue()
    // Render every 100 ms tick, as the browser does.
    const play = (ms: number) => {
      for (let elapsed = 0; elapsed < ms; elapsed += 100) {
        act(() => vi.advanceTimersByTime(100))
      }
    }
    try {
      renderTimer()
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      play(41_000)
      expect(beep).not.toHaveBeenCalled()

      play(1_000)
      expect(beep).toHaveBeenCalledOnce()

      // A restarted interval counts down out loud again.
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      play(45_000)
      expect(screen.getByRole('heading', { name: 'Rest' })).toBeVisible()
      expect(beep.mock.calls).toEqual(Array(4).fill(['rest']))

      play(15_000)
      expect(screen.getByRole('heading', { name: 'Plank' })).toBeVisible()
      expect(beep.mock.calls.slice(4)).toEqual([['work'], ['work'], ['work']])
    } finally {
      beep.mockRestore()
      vi.useRealTimers()
    }
  })

  it('asks before ending, then reports the stopped run', async () => {
    const user = userEvent.setup()
    const props = renderTimer()

    await user.keyboard('{Escape}')
    const dialog = screen.getByRole('alertdialog', { name: 'End this workout?' })
    expect(within(dialog).getByRole('button', { name: 'Keep going' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Warm-up · block 1 of 4')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'End workout' }))
    expect(props.onProgress).toHaveBeenLastCalledWith(0, false)
    expect(props.onExit).toHaveBeenCalledOnce()
  })
})
