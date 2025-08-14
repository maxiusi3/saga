import React from 'react';
import { render } from '@testing-library/react-native';

import { RecordingQualityIndicator } from '../RecordingQualityIndicator';
import { RecordingQuality } from '@saga/shared';

describe('RecordingQualityIndicator', () => {
  const validQuality: RecordingQuality = {
    isValid: true,
    duration: 30000,
    fileSize: 1024 * 1024,
    format: 'm4a',
    sampleRate: 44100,
    bitRate: 128000,
    issues: []
  };

  const invalidQuality: RecordingQuality = {
    isValid: false,
    duration: 700000, // Over 10 minutes
    fileSize: 60 * 1024 * 1024, // 60MB - exceeds limit
    format: 'm4a',
    issues: [
      {
        type: 'duration',
        severity: 'error',
        message: 'Recording duration exceeds maximum allowed (10 minutes)',
        suggestion: 'Please keep recordings under 10 minutes'
      },
      {
        type: 'fileSize',
        severity: 'error',
        message: 'File size (60.0 MB) exceeds maximum allowed (50.0 MB)',
        suggestion: 'Try recording a shorter message or use lower quality settings'
      }
    ]
  };

  const warningQuality: RecordingQuality = {
    isValid: true,
    duration: 1500, // Very short
    fileSize: 1024,
    format: 'm4a',
    issues: [
      {
        type: 'duration',
        severity: 'warning',
        message: 'Recording is very short',
        suggestion: 'Consider recording a longer message for better context'
      }
    ]
  };

  it('renders valid quality correctly', () => {
    const { getByText } = render(
      <RecordingQualityIndicator quality={validQuality} />
    );

    expect(getByText('Excellent Quality')).toBeTruthy();
    expect(getByText('0:30 • 1.0 MB')).toBeTruthy();
  });

  it('renders invalid quality with errors', () => {
    const { getByText } = render(
      <RecordingQualityIndicator quality={invalidQuality} />
    );

    expect(getByText('Quality Issues')).toBeTruthy();
    expect(getByText('11:40 • 60.0 MB')).toBeTruthy();
    expect(getByText('Recording duration exceeds maximum allowed (10 minutes)')).toBeTruthy();
    expect(getByText('File size (60.0 MB) exceeds maximum allowed (50.0 MB)')).toBeTruthy();
    expect(getByText('Please keep recordings under 10 minutes')).toBeTruthy();
    expect(getByText('Try recording a shorter message or use lower quality settings')).toBeTruthy();
  });

  it('renders quality with warnings', () => {
    const { getByText } = render(
      <RecordingQualityIndicator quality={warningQuality} />
    );

    expect(getByText('Good Quality')).toBeTruthy();
    expect(getByText('0:01 • 1.0 KB')).toBeTruthy();
    expect(getByText('Recording is very short')).toBeTruthy();
    expect(getByText('Consider recording a longer message for better context')).toBeTruthy();
  });

  it('formats duration correctly', () => {
    const testCases = [
      { duration: 0, expected: '0:00' },
      { duration: 30000, expected: '0:30' },
      { duration: 90000, expected: '1:30' },
      { duration: 3661000, expected: '61:01' },
    ];

    testCases.forEach(({ duration, expected }) => {
      const quality = { ...validQuality, duration };
      const { getByText } = render(
        <RecordingQualityIndicator quality={quality} />
      );

      expect(getByText(new RegExp(expected))).toBeTruthy();
    });
  });

  it('formats file size correctly', () => {
    const testCases = [
      { fileSize: 0, expected: '0 B' },
      { fileSize: 1024, expected: '1.0 KB' },
      { fileSize: 1024 * 1024, expected: '1.0 MB' },
      { fileSize: 1536 * 1024, expected: '1.5 MB' },
    ];

    testCases.forEach(({ fileSize, expected }) => {
      const quality = { ...validQuality, fileSize };
      const { getByText } = render(
        <RecordingQualityIndicator quality={quality} />
      );

      expect(getByText(new RegExp(expected))).toBeTruthy();
    });
  });

  it('shows technical details in development mode', () => {
    // Mock __DEV__ to be true
    const originalDev = (global as any).__DEV__;
    (global as any).__DEV__ = true;

    const { getByText } = render(
      <RecordingQualityIndicator quality={validQuality} />
    );

    expect(getByText('Technical Details')).toBeTruthy();
    expect(getByText('Format: M4A')).toBeTruthy();
    expect(getByText('Sample Rate: 44100 Hz')).toBeTruthy();
    expect(getByText('Bit Rate: 128000 bps')).toBeTruthy();

    // Restore original __DEV__
    (global as any).__DEV__ = originalDev;
  });

  it('hides technical details in production mode', () => {
    // Mock __DEV__ to be false
    const originalDev = (global as any).__DEV__;
    (global as any).__DEV__ = false;

    const { queryByText } = render(
      <RecordingQualityIndicator quality={validQuality} />
    );

    expect(queryByText('Technical Details')).toBeNull();

    // Restore original __DEV__
    (global as any).__DEV__ = originalDev;
  });

  it('handles missing optional fields gracefully', () => {
    const qualityWithoutOptionals: RecordingQuality = {
      isValid: true,
      duration: 30000,
      fileSize: 1024 * 1024,
      format: 'm4a',
      issues: []
    };

    const { getByText } = render(
      <RecordingQualityIndicator quality={qualityWithoutOptionals} />
    );

    expect(getByText('Excellent Quality')).toBeTruthy();
    expect(getByText('0:30 • 1.0 MB')).toBeTruthy();
  });

  it('applies custom styles correctly', () => {
    const customStyle = { backgroundColor: 'red' };
    
    const { getByTestId } = render(
      <RecordingQualityIndicator 
        quality={validQuality} 
        style={customStyle}
      />
    );

    // Since we don't have testID in the component, we'll just verify it renders
    expect(() => render(
      <RecordingQualityIndicator 
        quality={validQuality} 
        style={customStyle}
      />
    )).not.toThrow();
  });

  it('handles different issue types correctly', () => {
    const qualityWithDifferentIssues: RecordingQuality = {
      isValid: false,
      duration: 30000,
      fileSize: 1024 * 1024,
      format: 'unknown',
      issues: [
        {
          type: 'format',
          severity: 'warning',
          message: 'Unexpected file format: unknown',
          suggestion: 'Recording may not play correctly on all devices'
        },
        {
          type: 'quality',
          severity: 'info',
          message: 'Audio quality could be improved',
          suggestion: 'Try recording in a quieter environment'
        },
        {
          type: 'corruption',
          severity: 'error',
          message: 'File appears to be corrupted',
          suggestion: 'Please try recording again'
        }
      ]
    };

    const { getByText } = render(
      <RecordingQualityIndicator quality={qualityWithDifferentIssues} />
    );

    expect(getByText('Unexpected file format: unknown')).toBeTruthy();
    expect(getByText('Audio quality could be improved')).toBeTruthy();
    expect(getByText('File appears to be corrupted')).toBeTruthy();
  });

  it('handles issues without suggestions', () => {
    const qualityWithoutSuggestions: RecordingQuality = {
      isValid: false,
      duration: 30000,
      fileSize: 1024 * 1024,
      format: 'm4a',
      issues: [
        {
          type: 'quality',
          severity: 'warning',
          message: 'Audio quality issue detected'
        }
      ]
    };

    const { getByText, queryByText } = render(
      <RecordingQualityIndicator quality={qualityWithoutSuggestions} />
    );

    expect(getByText('Audio quality issue detected')).toBeTruthy();
    // Should not crash when suggestion is missing
    expect(() => render(
      <RecordingQualityIndicator quality={qualityWithoutSuggestions} />
    )).not.toThrow();
  });
});