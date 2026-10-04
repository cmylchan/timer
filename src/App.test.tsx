import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryStore } from './lib/storage'

describe('App', () => {
  it('lists the seed workouts until they have been run', async () => {
    render(<App store={createMemoryStore()} />)

    expect(
      await screen.findByRole('heading', { name: 'Your workouts' }),
    ).toBeVisible()
    expect(screen.queryByText('Recently run')).toBeNull()
    const notRun = screen.getByRole('region', { name: 'Not run yet' })
    expect(
      within(notRun)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Tuesday arms', 'Wednesday bodyweight', 'Friday shoulders'])
  })

  it('records a stopped run and shows it on the home screen', async () => {
    const user = userEvent.setup()
    const store = createMemoryStore()
    render(<App store={store} />)

    await user.click(
      await screen.findByRole('button', { name: 'Start Tuesday arms' }),
    )
    expect(screen.getByRole('heading', { name: 'Run / stretch' })).toBeVisible()

    await user.keyboard('{Escape}')
    const dialog = screen.getByRole('alertdialog', { name: 'End this workout?' })
    await user.click(within(dialog).getByRole('button', { name: 'End workout' }))

    const recent = screen.getByRole('region', { name: 'Recently run' })
    expect(within(recent).getByText('Today · stopped at 0:00 of 47:00')).toBeVisible()
    const saved = await store.load()
    expect(saved.runs).toEqual([
      expect.objectContaining({
        workoutName: 'Tuesday arms',
        completed: false,
        totalSeconds: 47 * 60,
      }),
    ])
  })

  it('creates a workout from the standard template', async () => {
    const user = userEvent.setup()
    const store = createMemoryStore()
    render(<App store={store} />)

    await user.click(
      await screen.findByRole('button', { name: 'Create new workout' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'New workout' })
    await user.type(within(dialog).getByLabelText('Name'), 'Thursday legs')
    await user.click(within(dialog).getByRole('button', { name: 'Thursday' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(screen.getByLabelText('Workout name')).toHaveValue('Thursday legs')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('heading', { name: 'Thursday legs' })).toBeVisible()
    expect(screen.getByText('Thu')).toBeVisible()
    const saved = await store.load()
    expect(saved.workouts.at(-1)).toMatchObject({
      name: 'Thursday legs',
      days: ['Thursday'],
    })
    expect(saved.workouts.at(-1)?.blocks).toHaveLength(4)
  })

  it('requires a name for a new workout', async () => {
    const user = userEvent.setup()
    render(<App store={createMemoryStore()} />)

    await user.click(
      await screen.findByRole('button', { name: 'Create new workout' }),
    )
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByText('Give the workout a name.')).toBeVisible()
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })
})
