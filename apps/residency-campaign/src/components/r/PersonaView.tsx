import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import PatternWorld from './PatternWorld';
import SwipeCard from './SwipeCard';
import { useResidencyStore } from '../../stores/residencyStore';
import { traitsFromOnairos, HEADLINE } from '../../data/residency';

export default function PersonaView({
  onFindPeople,
  onClose,
}: {
  onFindPeople: () => void;
  onClose?: () => void;
}) {
  const {
    name,
    points,
    agreed,
    fit,
    onairos,
    onairosData,
    aiHeadline,
    agree,
    dropPoint,
    editPoint,
    addPoint,
    setFit,
  } = useResidencyStore();

  const [newPointText, setNewPointText] = useState('');

  const headline = aiHeadline || (points.length ? HEADLINE : 'Force is observing your residency patterns.');
  const dynamicTraits = useMemo(() => traitsFromOnairos(onairosData), [onairosData]);

  const handleAddCustomPoint = () => {
    if (newPointText.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addPoint(newPointText.trim());
      setNewPointText('');
    }
  };

  const handleSelectFit = (val: 'spot' | 'mostly' | 'no') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFit(val);
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
          <Text style={styles.topNavTitle}>Persona</Text>
          <View style={{ width: 36 }} />
        </View>
      )}

      {/* 3D Pattern World Sphere Canvas */}
      <PatternWorld />

      {/* Headline */}
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.subtext}>
        From your three answers{onairos === 'on' ? ', Onairos' : ''} and what's public under your name.
      </Text>

      {/* Pattern Cards List with Swiping */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>The Patterns Force Noticed</Text>
        <Text style={styles.sectionSub}>Swipe right if that's you, swipe left if not, tap to rewrite.</Text>

        <View style={styles.cardsList}>
          {points.map((p) => (
            <SwipeCard
              key={p.id}
              point={p}
              isAgreed={agreed.includes(p.id)}
              onAgree={agree}
              onDrop={dropPoint}
              onEdit={editPoint}
            />
          ))}

          {/* Add something Force missed input */}
          <View style={styles.addInputRow}>
            <TextInput
              value={newPointText}
              onChangeText={setNewPointText}
              placeholder="Something Force missed…"
              placeholderTextColor="#A1A1AA"
              style={styles.addInput}
            />
            {newPointText.trim().length > 0 && (
              <TouchableOpacity onPress={handleAddCustomPoint} style={styles.addBtn}>
                <Feather name="arrow-up" size={16} color="#FAF9F6" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* How You Show Up (Big Five Traits from Onairos) */}
      {onairos === 'on' && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>How You Show Up</Text>
          <Text style={styles.sectionSub}>From the accounts you connected via Onairos.</Text>
          <View style={styles.traitsGrid}>
            {dynamicTraits.map((t, idx) => (
              <View
                key={t.name}
                style={[
                  styles.traitCard,
                  idx === dynamicTraits.length - 1 && styles.traitCardFull,
                ]}
              >
                <Text style={styles.traitName}>{t.name}</Text>
                <Text style={styles.traitLevel}>{t.level}</Text>
                <Text style={styles.traitLine}>{t.line}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Fit Rating Control */}
      <View style={styles.fitSection}>
        <Text style={styles.fitHeader}>How close is this read?</Text>
        <View style={styles.fitSegments}>
          {(['spot', 'mostly', 'no'] as const).map((opt) => {
            const isSelected = fit === opt;
            const labels = { spot: 'Spot on', mostly: 'Mostly', no: 'Not really' };
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => handleSelectFit(opt)}
                style={[styles.fitBtn, isSelected && styles.fitBtnActive]}
              >
                <Text style={[styles.fitBtnText, isSelected && styles.fitBtnTextActive]}>
                  {labels[opt]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Primary Action Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onFindPeople();
        }}
        style={styles.findPeopleBtn}
      >
        <Text style={styles.findPeopleBtnText}>Find people with this energy</Text>
        <Feather name="arrow-right" size={18} color="#FAF9F6" />
      </TouchableOpacity>
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
    paddingTop: 12,
    paddingBottom: 60,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#18181B',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtext: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 6,
    lineHeight: 18,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#71717A',
  },
  sectionSub: {
    fontSize: 13,
    color: '#52525B',
    marginTop: 2,
    marginBottom: 12,
  },
  cardsList: {
    gap: 8,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  addInput: {
    flex: 1,
    fontSize: 14,
    color: '#18181B',
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#18181B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  traitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  traitCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  traitCardFull: {
    width: '100%',
  },
  traitName: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  traitLevel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181B',
    marginTop: 4,
  },
  traitLine: {
    fontSize: 12,
    color: '#52525B',
    marginTop: 4,
    lineHeight: 16,
  },
  fitSection: {
    marginTop: 28,
    alignItems: 'center',
  },
  fitHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
    marginBottom: 10,
  },
  fitSegments: {
    flexDirection: 'row',
    backgroundColor: '#E4E4E7',
    borderRadius: 20,
    padding: 4,
  },
  fitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  fitBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  fitBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
  },
  fitBtnTextActive: {
    color: '#18181B',
    fontWeight: '600',
  },
  findPeopleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#18181B',
    paddingVertical: 16,
    borderRadius: 28,
    marginTop: 24,
  },
  findPeopleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FAF9F6',
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
