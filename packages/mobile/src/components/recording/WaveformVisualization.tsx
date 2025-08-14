import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { COLORS } from '../../utils/constants';

interface WaveformVisualizationProps {
  audioUri: string;
  duration: number;
  currentPosition: number;
  isPlaying: boolean;
  onSeek?: (position: number) => void;
  style?: any;
  barCount?: number;
  barWidth?: number;
  barSpacing?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export const WaveformVisualization: React.FC<WaveformVisualizationProps> = ({
  audioUri,
  duration,
  currentPosition,
  isPlaying,
  onSeek,
  style,
  barCount = 50,
  barWidth = 3,
  barSpacing = 2,
}) => {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [containerWidth, setContainerWidth] = useState(screenWidth - 64);
  const progressPosition = useSharedValue(0);

  useEffect(() => {
    generateWaveformData();
  }, [audioUri, barCount]);

  useEffect(() => {
    // Update progress position based on current playback position
    const progress = duration > 0 ? currentPosition / duration : 0;
    progressPosition.value = withSpring(progress * containerWidth, {
      damping: 15,
      stiffness: 150,
    });
  }, [currentPosition, duration, containerWidth]);

  const generateWaveformData = async () => {
    // For now, generate mock waveform data
    // In a production app, you would analyze the actual audio file
    const mockData: number[] = [];
    
    for (let i = 0; i < barCount; i++) {
      // Generate realistic-looking waveform with some variation
      const baseHeight = 0.3 + Math.random() * 0.7;
      const variation = Math.sin(i * 0.1) * 0.2;
      const height = Math.max(0.1, Math.min(1, baseHeight + variation));
      mockData.push(height);
    }
    
    setWaveformData(mockData);
  };

  const handleSeek = (x: number) => {
    if (!onSeek || duration <= 0) return;
    
    const progress = Math.max(0, Math.min(1, x / containerWidth));
    const seekPosition = progress * duration;
    onSeek(seekPosition);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const clampedX = Math.max(0, Math.min(containerWidth, event.x));
      progressPosition.value = clampedX;
    })
    .onEnd((event) => {
      const clampedX = Math.max(0, Math.min(containerWidth, event.x));
      runOnJS(handleSeek)(clampedX);
    });

  const handleTap = (event: any) => {
    const { locationX } = event.nativeEvent;
    handleSeek(locationX);
  };

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progressPosition.value }],
  }));

  const totalWidth = barCount * (barWidth + barSpacing) - barSpacing;
  const actualBarWidth = containerWidth > 0 ? (containerWidth / barCount) - barSpacing : barWidth;

  return (
    <View
      style={[styles.container, style]}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={styles.waveformContainer}>
          <Svg
            width={containerWidth}
            height={80}
            style={styles.waveform}
          >
            {waveformData.map((height, index) => {
              const x = index * (actualBarWidth + barSpacing);
              const barHeight = height * 60; // Max height of 60
              const y = (80 - barHeight) / 2; // Center vertically
              
              // Determine bar color based on progress
              const barProgress = x / containerWidth;
              const currentProgress = duration > 0 ? currentPosition / duration : 0;
              const isPlayed = barProgress <= currentProgress;
              
              return (
                <Rect
                  key={index}
                  x={x}
                  y={y}
                  width={actualBarWidth}
                  height={barHeight}
                  fill={isPlayed ? COLORS.primary : COLORS.gray300}
                  rx={actualBarWidth / 2}
                />
              );
            })}
          </Svg>

          {/* Progress Indicator */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.progressIndicator, progressStyle]}>
              <View style={styles.progressHandle} />
            </Animated.View>
          </GestureDetector>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 80,
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    position: 'relative',
  },
  waveform: {
    flex: 1,
  },
  progressIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressHandle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.background,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});