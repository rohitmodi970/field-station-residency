import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Glass from './Glass';
import { audioManager } from '../../lib/audio';
import type { Clip } from '../../data/mira';

export function ForceBubble({ text }: { text: string }) {
  return (
    <View style={styles.forceRow}>
      <Glass size={28} art="hills" zoom={260}>
        <View style={styles.forceDot} />
      </Glass>
      <View style={styles.forceBubble}>
        <Text style={styles.forceText}>{text}</Text>
      </View>
    </View>
  );
}

export function UserBubble({ text, clip }: { text?: string; clip?: Clip }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    if (!clip?.src) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      await audioManager.stopPlayback();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      await audioManager.playAudio(clip.src, () => setIsPlaying(false));
    }
  };

  return (
    <View style={styles.userRow}>
      {clip?.src ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePlay}
          style={styles.audioBubble}
        >
          <View style={styles.playIconContainer}>
            <Feather name={isPlaying ? 'pause' : 'play'} size={14} color="#18181B" />
          </View>
          <View style={styles.audioDetails}>
            <Text style={styles.audioText} numberOfLines={1}>
              {clip.transcript ? `“${clip.transcript.slice(0, 40)}…”` : 'Voice note'}
            </Text>
            <Text style={styles.audioMeta}>
              {clip.secs ? `${Math.round(clip.secs)}s` : 'Recording'}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{text}</Text>
        </View>
      )}
    </View>
  );
}

export function TypingDots() {
  return (
    <View style={styles.forceRow}>
      <Glass size={28} art="hills" zoom={260}>
        <View style={styles.forceDot} />
      </Glass>
      <View style={[styles.forceBubble, styles.typingBubble]}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotMiddle]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  forceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  forceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8f5317',
  },
  forceBubble: {
    maxWidth: '82%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  forceText: {
    color: '#18181B',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopRightRadius: 4,
  },
  userText: {
    color: '#FAF9F6',
    fontSize: 15,
    lineHeight: 22,
  },
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    maxWidth: '84%',
  },
  playIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioDetails: {
    flex: 1,
  },
  audioText: {
    fontSize: 13,
    color: '#18181B',
    fontWeight: '500',
  },
  audioMeta: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A1A1AA',
    opacity: 0.6,
  },
  dotMiddle: {
    opacity: 0.9,
  },
});
