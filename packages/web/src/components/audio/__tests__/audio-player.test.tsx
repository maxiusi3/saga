import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AudioPlayer } from '../audio-player'

// Mock HTMLAudioElement
const mockAudio = {
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentTime: 0,
  duration: 100,
  playbackRate: 1,
  volume: 1,
}

// Mock HTMLAudioElement constructor
global.HTMLAudioElement = jest.fn(() => mockAudio) as any

describe('AudioPlayer', () => {
  const defaultProps = {
    src: 'https://example.com/audio.mp3',
    title: 'Test Audio',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders audio player with title', () => {
    render(<AudioPlayer {...defaultProps} />)

    expect(screen.getByText('Test Audio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('renders without title when not provided', () => {
    render(<AudioPlayer src={defaultProps.src} />)

    expect(screen.queryByText('Test Audio')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('toggles play/pause when button clicked', async () => {
    render(<AudioPlayer {...defaultProps} />)

    const playButton = screen.getByRole('button', { name: /play/i })
    
    // Click to play
    fireEvent.click(playButton)
    expect(mockAudio.play).toHaveBeenCalled()

    // Simulate playing state
    fireEvent.click(playButton)
    expect(mockAudio.pause).toHaveBeenCalled()
  })

  it('shows loading state initially', () => {
    render(<AudioPlayer {...defaultProps} />)

    const playButton = screen.getByRole('button', { name: /play/i })
    expect(playButton).toBeDisabled()
  })

  it('updates playback rate when changed', () => {
    render(<AudioPlayer {...defaultProps} />)

    const speedSelect = screen.getByDisplayValue('1x')
    fireEvent.change(speedSelect, { target: { value: '1.5' } })

    expect(mockAudio.playbackRate).toBe(1.5)
  })

  it('updates volume when changed', () => {
    render(<AudioPlayer {...defaultProps} />)

    const volumeSlider = screen.getByDisplayValue('1')
    fireEvent.change(volumeSlider, { target: { value: '0.5' } })

    expect(mockAudio.volume).toBe(0.5)
  })

  it('seeks to correct time when progress bar changed', () => {
    render(<AudioPlayer {...defaultProps} />)

    const progressSlider = screen.getByDisplayValue('0')
    fireEvent.change(progressSlider, { target: { value: '50' } })

    expect(mockAudio.currentTime).toBe(50)
  })

  it('skips backward 10 seconds', () => {
    mockAudio.currentTime = 30
    mockAudio.duration = 100

    render(<AudioPlayer {...defaultProps} />)

    const skipBackButton = screen.getByTitle('Skip back 10 seconds')
    fireEvent.click(skipBackButton)

    expect(mockAudio.currentTime).toBe(20)
  })

  it('skips forward 10 seconds', () => {
    mockAudio.currentTime = 30
    mockAudio.duration = 100

    render(<AudioPlayer {...defaultProps} />)

    const skipForwardButton = screen.getByTitle('Skip forward 10 seconds')
    fireEvent.click(skipForwardButton)

    expect(mockAudio.currentTime).toBe(40)
  })

  it('does not skip beyond audio bounds', () => {
    mockAudio.currentTime = 5
    mockAudio.duration = 100

    render(<AudioPlayer {...defaultProps} />)

    // Skip back beyond start
    const skipBackButton = screen.getByTitle('Skip back 10 seconds')
    fireEvent.click(skipBackButton)
    expect(mockAudio.currentTime).toBe(0)

    // Skip forward beyond end
    mockAudio.currentTime = 95
    const skipForwardButton = screen.getByTitle('Skip forward 10 seconds')
    fireEvent.click(skipForwardButton)
    expect(mockAudio.currentTime).toBe(100)
  })

  it('formats time correctly', () => {
    mockAudio.currentTime = 65 // 1:05
    mockAudio.duration = 3665 // 61:05

    render(<AudioPlayer {...defaultProps} />)

    expect(screen.getByText('1:05')).toBeInTheDocument()
    expect(screen.getByText('61:05')).toBeInTheDocument()
  })

  it('handles invalid time values', () => {
    mockAudio.currentTime = NaN
    mockAudio.duration = NaN

    render(<AudioPlayer {...defaultProps} />)

    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('calls onTimeUpdate callback', () => {
    const onTimeUpdate = jest.fn()
    render(<AudioPlayer {...defaultProps} onTimeUpdate={onTimeUpdate} />)

    // Simulate time update event
    const timeUpdateHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'timeupdate'
    )?.[1]

    if (timeUpdateHandler) {
      mockAudio.currentTime = 30
      mockAudio.duration = 100
      timeUpdateHandler()
      expect(onTimeUpdate).toHaveBeenCalledWith(30, 100)
    }
  })

  it('calls onEnded callback', () => {
    const onEnded = jest.fn()
    render(<AudioPlayer {...defaultProps} onEnded={onEnded} />)

    // Simulate ended event
    const endedHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'ended'
    )?.[1]

    if (endedHandler) {
      endedHandler()
      expect(onEnded).toHaveBeenCalled()
    }
  })

  it('shows error state when audio fails to load', () => {
    render(<AudioPlayer {...defaultProps} />)

    // Simulate error event
    const errorHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'error'
    )?.[1]

    if (errorHandler) {
      errorHandler()
      expect(screen.getByText('Failed to load audio')).toBeInTheDocument()
    }
  })

  it('applies custom className', () => {
    const { container } = render(
      <AudioPlayer {...defaultProps} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('cleans up event listeners on unmount', () => {
    const { unmount } = render(<AudioPlayer {...defaultProps} />)

    const addEventListenerCalls = mockAudio.addEventListener.mock.calls.length
    
    unmount()

    expect(mockAudio.removeEventListener).toHaveBeenCalledTimes(addEventListenerCalls)
  })
})