import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PRESET_WORKOUTS } from '../data/presets'
import { cloneWorkout } from '../lib/workout'
import { WorkoutEditor } from './WorkoutEditor'

describe('WorkoutEditor', () => {
  it('shows field validation and prevents invalid link creation', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => null)
    render(
      <WorkoutEditor
        initialWorkout={cloneWorkout(PRESET_WORKOUTS.wednesday)}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    )

    const name = screen.getByLabelText('Workout name')
    await user.clear(name)

    expect(
      screen.getAllByText('Workout name is required.'),
    ).not.toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'Create workout link' }),
    ).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('submits a valid edited workout', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => null)
    render(
      <WorkoutEditor
        initialWorkout={cloneWorkout(PRESET_WORKOUTS.friday)}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    )

    const name = screen.getByLabelText('Workout name')
    await user.clear(name)
    await user.type(name, 'Friday remix')
    await user.click(
      screen.getByRole('button', { name: 'Create workout link' }),
    )

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Friday remix' }),
    )
  })
})
