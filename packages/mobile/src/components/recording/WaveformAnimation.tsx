import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

interface Props {
  isRecording: boolean;
  duration: number;
}

const { width } = Dimensions.get('window');
const WAVE_COUNT = 20;
const WAVE_WIDTH = (width - 80) / WAVE_COUNT;

export function WaveformAnimation({ isRecording, duration }: Props) {
  const waveAnimations = useRef(
    Array.from({ length: WAVE_COUNT }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (isRecording) {
      // Create staggered wave animations
      const animations = waveAnimations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.8 + 0.2, // Random height between 0.2 and 1
              duration: 150 + Math.random() * 100, // Random duration
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.5 + 0.1,
              duration: 150 + Math.random() * 100,
              useNativeDriver: true,
            }),
          ])
        );
      });

      // Start animations with slight delays
      animations.forEach((animation, index) => {
        setTimeout(() => {
          animation.start();
        }, index * 50);
      });

      return () => {
        animations.forEach(animation => animation.stop());
      };
    } else {
      // Reset to baseline when not recording
      const resetAnimations = waveAnimations.map(anim =>
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: true,
        })
      );

      Animated.parallel(resetAnimations).start();
    }
  }, [isRecording, waveAnimations]);

  return (
    <View style={styles.container}>
      <View style={styles.waveform}>
        {waveAnimations.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.wave,
              {
                width: WAVE_WIDTH - 2,
                transform: [{ scaleY: anim }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    gap: 2,
  },
  wave: {
    backgroundColor: '#2563eb',
    borderRadius: 2,
    height: 60,
    opacity: 0.8,
  },
});