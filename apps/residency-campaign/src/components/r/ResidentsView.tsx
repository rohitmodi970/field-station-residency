import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Glass from '../f/Glass';
import { RESIDENTS, type Resident } from '../../data/residency';

export default function ResidentsView({ onSelectResident }: { onSelectResident?: (r: Resident) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleCardPress = (r: Resident) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(selectedId === r.id ? null : r.id);
    onSelectResident?.(r);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Residents in the Space</Text>
        <Text style={styles.subtitle}>
          People working around complementary themes and similar energy.
        </Text>
      </View>

      <View style={styles.residentsList}>
        {RESIDENTS.map((res) => {
          const isExpanded = selectedId === res.id;
          return (
            <TouchableOpacity
              key={res.id}
              activeOpacity={0.9}
              onPress={() => handleCardPress(res)}
              style={styles.residentCard}
            >
              <View style={styles.cardTop}>
                <Glass size={44} art={res.art} zoom={260}>
                  <View style={styles.faceDot} />
                </Glass>
                <View style={styles.residentInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.residentName}>{res.name}</Text>
                    {res.energy && (
                      <View style={styles.energyTag}>
                        <Text style={styles.energyText}>{Math.round(res.energy * 100)}% match</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.residentWork}>{res.work}</Text>
                </View>
              </View>

              {res.pattern && (
                <View style={styles.patternBox}>
                  <Text style={styles.patternText}>✨ {res.pattern}</Text>
                </View>
              )}

              {isExpanded && res.together && (
                <View style={styles.togetherBox}>
                  <Text style={styles.togetherHeader}>Suggested Side Quest</Text>
                  <Text style={styles.togetherText}>{res.together}</Text>
                  {res.reply && (
                    <View style={styles.replyPreview}>
                      <Text style={styles.replyAuthor}>{res.name}:</Text>
                      <Text style={styles.replyText}>“{res.reply}”</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
    marginTop: 6,
    lineHeight: 20,
  },
  residentsList: {
    gap: 12,
  },
  residentCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  faceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#18181B',
  },
  residentInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  residentName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#18181B',
  },
  energyTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  energyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  residentWork: {
    fontSize: 13,
    color: '#52525B',
    marginTop: 4,
    lineHeight: 18,
  },
  patternBox: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginTop: 12,
  },
  patternText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#18181B',
  },
  togetherBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  togetherHeader: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 4,
  },
  togetherText: {
    fontSize: 13,
    color: '#18181B',
    lineHeight: 19,
  },
  replyPreview: {
    backgroundColor: '#FAF9F6',
    borderLeftWidth: 3,
    borderLeftColor: '#76ade2',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: '#245a8f',
  },
  replyText: {
    fontSize: 12,
    color: '#52525B',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
