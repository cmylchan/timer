import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import type { CircuitBlock, Workout } from '../types/workout'
import { WorkoutEditor } from './WorkoutEditor'

const tuesday = createSeedWorkouts(0)[0]

function renderEditor(workout: Workout = tuesday, isNew = false) {
  const props = {
    workout,
    isNew,
    onSave: vi.fn(),
    onStart: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  }
  render(<WorkoutEditor {...props} />)
  return props
}

function savedWorkout(onSave: ReturnType<typeof vi.fn>): Workout {
  return onSave.mock.calls[0][0] as Workout
}

describe('WorkoutEditor', () => {
  it('shows blocks, per-round weights, and the summary rail', () => {
    renderEditor()

    expect(screen.getByLabelText('Workout name')).toHaveValue('Tuesday arms')
    expect(screen.getByLabelText('Run / stretch duration')).toHaveValue('25:00')
    expect(
      screen.getByLabelText('Bicep curls, round 2 weight in lb'),
    ).toHaveValue('20')
    expect(
      screen.getAllByLabelText('Plank, round 1 weight in lb')[0],
    ).toHaveAttribute('placeholder', '—')

    const summary = screen.getByRole('complementary', { name: 'Summary' })
    expect(within(summary).getByText('47:00')).toBeVisible()
    expect(within(summary).getByText('Dumbbells: 5, 15, 20 lb')).toBeVisible()
  })

  it('fills later rounds from a weight typed in R1', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.type(screen.getAllByLabelText('Plank, round 1 weight in lb')[0], '10')

    expect(screen.getAllByLabelText('Plank, round 2 weight in lb')[0]).toHaveValue('10')
    expect(screen.getAllByLabelText('Plank, round 3 weight in lb')[0]).toHaveValue('10')
    expect(screen.getByText('Dumbbells: 5, 10, 15, 20 lb')).toBeVisible()
  })

  it('adds a weight column when rounds go up', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    const rounds = screen.getByRole('textbox', { name: 'Rounds' })
    await user.clear(rounds)
    await user.type(rounds, '4')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const circuit = savedWorkout(onSave).blocks[2] as CircuitBlock
    expect(circuit.rounds).toBe(4)
    expect(circuit.exercises[0].weights).toEqual([15, 20, 20, 20])
  })

  it('validates fields and blocks saving', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    await user.clear(screen.getByLabelText('Workout name'))

    expect(screen.getByText('Workout name is required.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves name, order, and duration edits', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    await user.clear(screen.getByLabelText('Workout name'))
    await user.type(screen.getByLabelText('Workout name'), 'Heavier Tuesday')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Order' }), 'sets')
    const warmup = screen.getByLabelText('Run / stretch duration')
    await user.clear(warmup)
    await user.type(warmup, '20')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const saved = savedWorkout(onSave)
    expect(saved.name).toBe('Heavier Tuesday')
    expect((saved.blocks[2] as CircuitBlock).order).toBe('sets')
    expect(saved.blocks[0]).toMatchObject({ durationSeconds: 20 * 60 })
  })

  it('reorders blocks from the keyboard', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()

    const grip = screen.getByRole('button', { name: /^Move Set up equipment/ })
    grip.focus()
    await user.keyboard('{ArrowUp}')

    expect(grip).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(savedWorkout(onSave).blocks.map((block) => block.name)).toEqual([
      'Set up equipment',
      'Run / stretch',
      'Arms and core',
      'Put equipment away',
    ])
  })

  it('changes a timed block kind from its menu', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Run / stretch options' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Recovery' }))

    const block = screen.getByRole('region', { name: 'Recovery: Run / stretch' })
    expect(block).toBeVisible()
  })

  it('asks before deleting a saved workout', async () => {
    const user = userEvent.setup()
    const { onDelete } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Tuesday arms?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledWith(tuesday)
  })

  it('asks before discarding unsaved changes', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Workouts' }))
    expect(onClose).toHaveBeenCalledOnce()

    await user.type(screen.getByLabelText('Workout name'), '!')
    await user.click(screen.getByRole('button', { name: 'Workouts' }))
    expect(
      screen.getByRole('alertdialog', { name: 'Discard your changes?' }),
    ).toBeVisible()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
