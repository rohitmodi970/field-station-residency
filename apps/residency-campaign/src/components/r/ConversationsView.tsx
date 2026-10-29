import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Glass from '../f/Glass';
import { RESIDENTS, type Resident } from '../../data/residency';
import { QUESTS } from '../../data/social';

export default function ConversationsView({
  onSelectResident,
  onOpenForceChat,
}: {
  onSelectResident?: (r: Resident) => void;
  onOpenForceChat?: () => void;
}) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Conversations</Text>
        <Text style={styles.subtitle}>
          Active threads with Force and residents who share your focus.
        </Text>
      </View>

      {/* Force Main Thread Row */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenForceChat?.();
        }}
        style={styles.forceCard}
      >
        <Glass size={48} art="water" zoom={300}>
          <View style={styles.forceDot} />
        </Glass>
        <View style={styles.forceInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.forceTitle}>Force Companion</Text>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>Core</Text>
            </View>
          </View>
          <Text style={styles.forceLine} numberOfLines={1}>
            Talk, type or add a photo. It all becomes memory.
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="#A1A1AA" />
      </TouchableOpacity>

      {/* Resident Conversations */}
      <View style={styles.residentsList}>
        {RESIDENTS.map((res) => (
          <TouchableOpacity
            key={res.id}
            activeOpacity={0.88}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectResident?.(res);
            }}
            style={styles.threadCard}
          >
            <Glass size={44} art={res.art} zoom={260}>
              <View style={styles.faceDot} />
            </Glass>
            <View style={styles.threadInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.residentName}>{res.name}</Text>
                {res.energy && (
                  <Text style={styles.energyText}>{Math.round(res.energy * 100)}% match</Text>
                )}
              </View>
              <Text style={styles.threadSnippet} numberOfLines={1}>
                {res.reply ? `“${res.reply}”` : res.work}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#D4D4D8" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Suggested Quests Section */}
      <View style={styles.questsSection}>
        <Text style={styles.sectionHeader}>Side Quests Underway</Text>
        {QUESTS.map((q) => (
          <View key={q.id} style={styles.questCard}>
            <View style={styles.questTop}>
              <Glass size={30} art={q.art} zoom={260}>
                <View style={styles.questDot} />
              </Glass>
              <Text style={styles.questName}>{q.name}</Text>
            </View>
            <Text style={styles.questLine}>{q.line}</Text>
          </View>
        ))}
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
    fontSize: 26,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 4,
    lineHeight: 20,
  },
  forceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F4F4F5',
  },
  forceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#18181B',
  },
  forceInfo: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#18181B',
  },
  aiTag: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  forceLine: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },
  residentsList: {
    gap: 10,
    marginBottom: 24,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  faceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  threadInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  residentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#18181B',
  },
  energyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  threadSnippet: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },
  questsSection: {
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  questCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  questTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  questDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
  },
  questName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
  },
  questLine: {
    fontSize: 13,
    color: '#71717A',
    lineHeight: 18,
  },
});
