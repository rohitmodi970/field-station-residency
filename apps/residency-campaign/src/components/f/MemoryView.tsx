import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Glass from './Glass';
import { useResidencyStore } from '../../stores/residencyStore';
import { QUESTS } from '../../data/social';
import type { Art } from '../../data/mira';

const CHIPS = ['All', 'Dates', 'Voice notes', 'Work', 'People'];

export default function MemoryView({ onClose }: { onClose?: () => void }) {
  const { name, answers, clips, points, uniqueId, logout } = useResidencyStore();
  const [activeChip, setActiveChip] = useState('All');

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {onClose && (
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={20} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.topNavTitle}>Memory</Text>
          <View style={{ width: 36 }} />
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Memory</Text>
        <Text style={styles.subtitle}>
          The ongoing map of your work, reflections, and residency energy.
        </Text>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {CHIPS.map((chip) => {
          const active = activeChip === chip;
          return (
            <TouchableOpacity
              key={chip}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveChip(chip);
              }}
              style={[styles.chip, active && styles.activeChip]}
            >
              <Text style={[styles.chipText, active && styles.activeChipText]}>
                {chip}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Side Quests Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Side quests Force noticed</Text>
        <View style={styles.questsList}>
          {QUESTS.map((q) => (
            <View key={q.id} style={styles.questCard}>
              <View style={styles.questTop}>
                <Glass size={32} art={q.art} zoom={260}>
                  <View style={styles.questDot} />
                </Glass>
                <Text style={styles.questName}>{q.name}</Text>
              </View>
              <Text style={styles.questLine}>{q.line}</Text>
              <View style={styles.nextBox}>
                <Feather name="arrow-right" size={12} color="#71717A" />
                <Text style={styles.nextText}>{q.next}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Moments / Answers Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Onboarding Moments</Text>
        <View style={styles.momentsList}>
          {answers.map((ans, i) => (
            <View key={i} style={styles.momentCard}>
              <Text style={styles.momentTitle}>Question {i + 1}</Text>
              <Text style={styles.momentText}>“{ans}”</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Logout Area */}
      <View style={styles.logoutWrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleLogout}
          style={styles.logoutBtn}
        >
          <Feather name="log-out" size={16} color="#DC2626" />
          <Text style={styles.logoutBtnText}>Log out & reset session</Text>
        </TouchableOpacity>
        <Text style={styles.logoutMeta}>
          {name ? `Signed in as ${name}` : 'Field Station Residency'}
          {uniqueId ? ` · ${uniqueId}` : ''}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 6,
    lineHeight: 20,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  activeChip: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  chipText: {
    fontSize: 13,
    color: '#52525B',
    fontWeight: '500',
  },
  activeChipText: {
    color: '#FAF9F6',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 12,
  },
  questsList: {
    gap: 12,
  },
  questCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  questTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  questDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8f5317',
  },
  questName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#18181B',
  },
  questLine: {
    fontSize: 13,
    color: '#52525B',
    lineHeight: 18,
  },
  nextBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  nextText: {
    fontSize: 12,
    color: '#71717A',
    fontStyle: 'italic',
  },
  momentsList: {
    gap: 10,
  },
  momentCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  momentTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
    textTransform: 'uppercase',
  },
  momentText: {
    fontSize: 14,
    color: '#18181B',
    marginTop: 4,
    lineHeight: 20,
  },
  logoutWrapper: {
    marginTop: 20,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  logoutMeta: {
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 10,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#18181B',
  },
});
