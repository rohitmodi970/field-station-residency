import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Glass from '../f/Glass';
import { useResidencyStore } from '../../stores/residencyStore';
import { LINKS, pretty, type LinkKind } from '../../data/residency';

export function NameField() {
  const { name, setName } = useResidencyStore();

  return (
    <View style={styles.nameFieldContainer}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor="#A1A1AA"
        autoCapitalize="words"
        autoComplete="name"
        style={styles.nameInput}
      />
    </View>
  );
}

function LinkRow({
  kind,
  name,
  art,
  value,
  onChange,
}: {
  kind: LinkKind | 'extra';
  name: string;
  art: any;
  value: string;
  onChange: (v: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = !!value.trim();

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text.trim()) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(text.trim());
      }
    } catch {}
  };

  return (
    <View style={[styles.linkRow, isFocused && styles.linkRowFocused]}>
      <Glass size={40} art={art} zoom={280}>
        <Feather name="link-2" size={16} color="#18181B" />
      </Glass>
      <TextInput
        value={isFocused ? value : hasValue ? pretty(kind, value) : ''}
        onChangeText={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={name}
        placeholderTextColor="#A1A1AA"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.linkInput}
      />
      {isFocused && (
        <TouchableOpacity
          onPress={handlePaste}
          style={styles.pasteButton}
        >
          <Text style={styles.pasteText}>Paste</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function LinkList() {
  const { links, extra, setLink, setExtra, addExtra } = useResidencyStore();

  return (
    <View style={styles.listContainer}>
      {LINKS.map((l) => (
        <LinkRow
          key={l.kind}
          kind={l.kind}
          name={l.name}
          art={l.art}
          value={links[l.kind] || ''}
          onChange={(v) => setLink(l.kind, v)}
        />
      ))}
      {extra.map((x, i) => (
        <LinkRow
          key={`extra-${i}`}
          kind="extra"
          name="Any other link"
          art="meadow"
          value={x}
          onChange={(v) => setExtra(i, v)}
        />
      ))}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          addExtra();
        }}
        style={styles.addExtraBtn}
      >
        <Feather name="plus" size={16} color="#52525B" />
        <Text style={styles.addExtraText}>Add another link</Text>
      </TouchableOpacity>
    </View>
  );
}

export function OnairosCard() {
  const { onairos, email, setOnairosComplete } = useResidencyStore();

  const handleSimulateOnairos = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Simulates or initiates native Onairos flow
    await setOnairosComplete({
      email: 'alex@example.com',
      traits: {
        openness: 0.85,
        conscientiousness: 0.72,
        extraversion: 0.55,
        agreeableness: 0.78,
        neuroticism: 0.32,
        archetype: 'Strategic Builder',
      },
      source_platforms: ['youtube', 'chatgpt', 'github'],
    });
  };

  return (
    <View style={styles.onairosCard}>
      <View style={styles.onairosTop}>
        <Glass size={48} art="water" zoom={260}>
          <Feather name="zap" size={20} color="#245a8f" />
        </Glass>
        <View style={styles.onairosInfo}>
          <Text style={styles.onairosTitle}>Onairos</Text>
          <Text style={styles.onairosSubtitle}>
            Your ChatGPT, Instagram and YouTube, even the private parts
          </Text>
        </View>
      </View>
      <Text style={styles.onairosDisclaimer}>
        Force gets a short read of your personality from it. Never your chats or posts.
      </Text>

      {onairos === 'on' ? (
        <View style={styles.connectedPill}>
          <Feather name="check" size={16} color="#166534" />
          <Text style={styles.connectedText}>
            Connected{email ? ` · ${email}` : ''}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSimulateOnairos}
          style={styles.connectBtn}
        >
          <Text style={styles.connectBtnText}>Connect with Onairos</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nameFieldContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 16,
  },
  nameInput: {
    fontSize: 16,
    color: '#18181B',
    fontWeight: '500',
  },
  listContainer: {
    gap: 10,
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    height: 60,
    paddingLeft: 10,
    paddingRight: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  linkRowFocused: {
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  linkInput: {
    flex: 1,
    fontSize: 15,
    color: '#18181B',
  },
  pasteButton: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pasteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181B',
  },
  addExtraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addExtraText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#52525B',
  },
  onairosCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  onairosTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  onairosInfo: {
    flex: 1,
  },
  onairosTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#18181B',
  },
  onairosSubtitle: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
    lineHeight: 16,
  },
  onairosDisclaimer: {
    fontSize: 13,
    color: '#52525B',
    marginTop: 14,
    lineHeight: 18,
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  connectBtn: {
    backgroundColor: '#18181B',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  connectBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FAF9F6',
  },
});
