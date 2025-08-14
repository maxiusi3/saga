import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PromptCard } from '../PromptCard';

const mockPrompt = {
  id: 'prompt-1',
  text: 'Tell me about your favorite childhood memory.',
  category: 'childhood' as const,
  difficulty: 'easy' as const,
};

describe('PromptCard', () => {
  const defaultProps = {
    prompt: mockPrompt,
    isPlaying: false,
    onPlay: jest.fn(),
    onStop: jest.fn(),
    onSkip: jest.fn(),
    onGetNew: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render prompt text and category', () => {
    const { getByText } = render(<PromptCard {...defaultProps} />);

    expect(getByText(mockPrompt.text)).toBeTruthy();
    expect(getByText('Childhood Memories')).toBeTruthy();
  });

  it('should show play button when not playing', () => {
    const { getByTestId } = render(<PromptCard {...defaultProps} />);

    const playButton = getByTestId('play-button');
    expect(playButton).toBeTruthy();
  });

  it('should show stop button when playing', () => {
    const { getByTestId } = render(
      <PromptCard {...defaultProps} isPlaying={true} />
    );

    const stopButton = getByTestId('stop-button');
    expect(stopButton).toBeTruthy();
  });

  it('should call onPlay when play button is pressed', () => {
    const { getByTestId } = render(<PromptCard {...defaultProps} />);

    fireEvent.press(getByTestId('play-button'));
    expect(defaultProps.onPlay).toHaveBeenCalled();
  });

  it('should call onStop when stop button is pressed', () => {
    const { getByTestId } = render(
      <PromptCard {...defaultProps} isPlaying={true} />
    );

    fireEvent.press(getByTestId('stop-button'));
    expect(defaultProps.onStop).toHaveBeenCalled();
  });

  it('should call onSkip when skip button is pressed', () => {
    const { getByText } = render(<PromptCard {...defaultProps} />);

    fireEvent.press(getByText('Skip This Prompt'));
    expect(defaultProps.onSkip).toHaveBeenCalled();
  });

  it('should call onGetNew when refresh button is pressed', () => {
    const { getByTestId } = render(<PromptCard {...defaultProps} />);

    fireEvent.press(getByTestId('refresh-button'));
    expect(defaultProps.onGetNew).toHaveBeenCalled();
  });

  it('should display correct category color for different difficulties', () => {
    const easyPrompt = { ...mockPrompt, difficulty: 'easy' as const };
    const mediumPrompt = { ...mockPrompt, difficulty: 'medium' as const };
    const hardPrompt = { ...mockPrompt, difficulty: 'hard' as const };

    const { rerender, getByTestId } = render(
      <PromptCard {...defaultProps} prompt={easyPrompt} />
    );
    expect(getByTestId('category-dot')).toHaveStyle({ backgroundColor: '#10b981' });

    rerender(<PromptCard {...defaultProps} prompt={mediumPrompt} />);
    expect(getByTestId('category-dot')).toHaveStyle({ backgroundColor: '#f59e0b' });

    rerender(<PromptCard {...defaultProps} prompt={hardPrompt} />);
    expect(getByTestId('category-dot')).toHaveStyle({ backgroundColor: '#ef4444' });
  });
});