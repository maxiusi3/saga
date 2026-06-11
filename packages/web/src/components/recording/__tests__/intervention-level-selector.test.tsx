import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { InterventionLevel } from '@saga/shared/types/agents'
import { InterventionLevelSelector } from '../InterventionLevelSelector'
import { RecorderHub } from '../RecorderHub'

describe('InterventionLevelSelector', () => {
  it('lets the user choose off, low, and high intervention levels', () => {
    const onChange = jest.fn()

    function StatefulSelector() {
      const [value, setValue] = useState<InterventionLevel>('low')

      return (
        <InterventionLevelSelector
          value={value}
          onChange={(level) => {
            setValue(level)
            onChange(level)
          }}
        />
      )
    }

    render(<StatefulSelector />)

    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: 'Off' }))
    expect(onChange).toHaveBeenLastCalledWith('off')

    fireEvent.click(screen.getByRole('radio', { name: 'Low' }))
    expect(onChange).toHaveBeenLastCalledWith('low')

    fireEvent.click(screen.getByRole('radio', { name: 'High' }))
    expect(onChange).toHaveBeenLastCalledWith('high')
  })
})

describe('RecorderHub intervention level selector', () => {
  it('only renders the selector when intervention props are provided', () => {
    const onModeSelect = jest.fn()
    const onInterventionLevelChange = jest.fn()
    const { rerender } = render(<RecorderHub onModeSelect={onModeSelect} />)

    expect(screen.queryByRole('radio', { name: 'Low' })).not.toBeInTheDocument()

    rerender(
      <RecorderHub
        onModeSelect={onModeSelect}
        interventionLevel="low"
        onInterventionLevelChange={onInterventionLevelChange}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Low' })).toBeInTheDocument()
  })
})
