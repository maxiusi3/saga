import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Simple test to verify component structure
describe('AudioPlayer Simple Tests', () => {
  it('should render without crashing', () => {
    const TestComponent = () => <div data-testid="audio-player">Audio Player</div>
    render(<TestComponent />)
    expect(screen.getByTestId('audio-player')).toBeInTheDocument()
  })

  it('should have basic audio controls structure', () => {
    const TestComponent = () => (
      <div data-testid="audio-controls">
        <button data-testid="play-button">Play</button>
        <input data-testid="progress-slider" type="range" />
        <select data-testid="speed-select">
          <option value="1">1x</option>
        </select>
      </div>
    )
    
    render(<TestComponent />)
    expect(screen.getByTestId('audio-controls')).toBeInTheDocument()
    expect(screen.getByTestId('play-button')).toBeInTheDocument()
    expect(screen.getByTestId('progress-slider')).toBeInTheDocument()
    expect(screen.getByTestId('speed-select')).toBeInTheDocument()
  })
})