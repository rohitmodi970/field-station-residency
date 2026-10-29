import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TextInput, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import type { Point } from '../../data/residency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

interface SwipeCardProps {
  point: Point;
  isAgreed: boolean;
  onAgree: (id: string) => void;
  onDrop: (id: string) => void;
  onEdit: (id: string, text: string) => void;
}

export default function SwipeCard({
  point,
  isAgreed,
  onAgree,
  onDrop,
  onEdit,
}: SwipeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(point.text);

  const translateX = useSharedValue(0);

  const triggerAgree = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAgree(point.id);
  };

  const triggerDrop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDrop(point.id);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withSpring(0);
        runOnJS(triggerAgree)();
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH, {}, () => {
          runOnJS(triggerDrop)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-200, 200], [-8, 8]);
    return {
      transform: [{ translateX: translateX.value }, { rotate: `${rotate}deg` }],
    };
  });

  const rightActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [20, 80], [0, 1]);
    return { opacity };
  });

  const leftActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [-80, -20], [1, 0]);
    return { opacity };
  });

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(point.id, editText.trim());
    }
    setIsEditing(false);
  };

  return (
    <View style={styles.container}>
      {/* Background Swipe Actions */}
      <Animated.View style={[styles.actionUnderlay, styles.agreeUnderlay, rightActionStyle]}>
        <Feather name="check-circle" size={20} color="#166534" />
        <Text style={styles.agreeActionText}>That's me</Text>
      </Animated.View>

      <Animated.View style={[styles.actionUnderlay, styles.dropUnderlay, leftActionStyle]}>
        <Text style={styles.dropActionText}>Not me</Text>
        <Feather name="x-circle" size={20} color="#991B1B" />
      </Animated.View>

      {/* Main Draggable Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, cardStyle, isAgreed && styles.cardAgreed]}>
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                value={editText}
                onChangeText={setEditText}
                style={styles.editInput}
                autoFocus
                multiline
              />
              <View style={styles.editButtons}>
                <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveEdit} style={styles.saveBtn}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setIsEditing(true)}
              style={styles.cardInner}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardText}>{point.text}</Text>
                {isAgreed && (
                  <View style={styles.agreedBadge}>
                    <Feather name="check" size={12} color="#166534" />
                  </View>
                )}
              </View>
              <Text style={styles.whyText}>{point.why}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    position: 'relative',
  },
  actionUnderlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  agreeUnderlay: {
    left: 0,
    right: '50%',
    backgroundColor: '#DCFCE7',
    justifyContent: 'flex-start',
  },
  agreeActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  dropUnderlay: {
    left: '50%',
    right: 0,
    backgroundColor: '#FEE2E2',
    justifyContent: 'flex-end',
  },
  dropActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F4F4F5',
  },
  cardAgreed: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  cardInner: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#18181B',
    lineHeight: 21,
  },
  agreedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whyText: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 6,
    lineHeight: 16,
  },
  editContainer: {
    width: '100%',
  },
  editInput: {
    fontSize: 15,
    color: '#18181B',
    lineHeight: 20,
    minHeight: 50,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 13,
    color: '#71717A',
  },
  saveBtn: {
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FAF9F6',
  },
});
