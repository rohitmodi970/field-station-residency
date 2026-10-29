import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Portal } from '@gorhom/portal';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Glass from './Glass';
import { audioManager } from '../../lib/audio';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VoiceModeProps {
  visible: boolean;
  onFinish: (audioUri: string | null) => void;
  onCancel: () => void;
  orbPosition?: { x: number; y: number }; // Screen position of the mic orb
}

export default function VoiceMode({
  visible,
  onFinish,
  onCancel,
  orbPosition = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT - 120 },
}: VoiceModeProps) {
  const [level, setLevel] = useState(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const voiceScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // Loop ripple animations
      ring1.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      setTimeout(() => {
        ring2.value = withRepeat(
          withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
          -1,
          false
        );
      }, 800);
      setTimeout(() => {
        ring3.value = withRepeat(
          withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
          -1,
          false
        );
      }, 1600);

      // Start audio recording with live metering
      audioManager.startRecording({
        onLevel: (normalized) => {
          setLevel(normalized);
          voiceScale.value = withTiming(1 + normalized * 0.45, { duration: 80 });
        },
        onError: (err) => {
          console.warn('[VoiceMode] Recorder error:', err);
          onCancel();
        },
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      ring1.value = 0;
      ring2.value = 0;
      ring3.value = 0;
      voiceScale.value = 1;
    }
  }, [visible]);

  const handleStop = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await audioManager.stopRecording();
    onFinish(uri);
  };

  const ringStyle = (shared: SharedValue<number>) =>
    useAnimatedStyle(() => {
      const scale = interpolate(shared.value, [0, 1], [0.6, 3.2]) * voiceScale.value;
      const opacity = interpolate(shared.value, [0, 0.25, 0.85, 1], [0, 0.4, 0.15, 0]);
      return {
        transform: [{ scale }],
        opacity,
      };
    });

  if (!visible) return null;

  return (
    <Portal>
      {/* 
        Fully transparent touch backdrop:
        Chat history, questions, and Force logo in the background remain 100% visible!
      */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleStop}
        style={styles.backdrop}
      >
        {/* Radiating Ripple Rings centered at orb position */}
        <View
          pointerEvents="none"
          style={[
            styles.rippleOrigin,
            {
              left: orbPosition.x - 70,
              top: orbPosition.y - 70,
            },
          ]}
        >
          <Animated.View style={[styles.ring, ringStyle(ring1)]} />
          <Animated.View style={[styles.ring, ringStyle(ring2)]} />
          <Animated.View style={[styles.ring, ringStyle(ring3)]} />
        </View>

        {/* Pulsing Active Orb */}
        <View
          style={[
            styles.orbContainer,
            {
              left: orbPosition.x - 32,
              top: orbPosition.y - 32,
            },
          ]}
        >
          <Glass size={64} art="water" zoom={260}>
            <View style={styles.micInner}>
              <View style={[styles.activeDot, { transform: [{ scale: 1 + level * 0.5 }] }]} />
            </View>
          </Glass>
        </View>

        {/* Soft tap-to-finish hint banner */}
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Listening… tap anywhere to finish</Text>
        </View>
      </TouchableOpacity>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 249, 246, 0.08)', // Ultra-transparent overlay so background chat stays crisp
    zIndex: 9999,
  },
  rippleOrigin: {
    position: 'absolute',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: '#76ade2',
    backgroundColor: 'rgba(118, 173, 226, 0.08)',
  },
  orbContainer: {
    position: 'absolute',
    width: 64,
    height: 64,
    shadowColor: '#76ade2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  micInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#245a8f',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: {
    color: '#FAF9F6',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
