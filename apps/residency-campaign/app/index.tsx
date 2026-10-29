import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useResidencyStore } from '../src/stores/residencyStore';
import Onboarding from '../src/components/r/Onboarding';
import ResidentsView from '../src/components/r/ResidentsView';
import ConversationsView from '../src/components/r/ConversationsView';
import PersonaView from '../src/components/r/PersonaView';
import MemoryView from '../src/components/f/MemoryView';
import Glass from '../src/components/f/Glass';

export default function ResidencyApp() {
  const { done, tab, setTab, name, finish } = useResidencyStore();
  const [overlayScreen, setOverlayScreen] = useState<'none' | 'persona' | 'memory'>('none');

  // If not completed onboarding, show full-screen onboarding experience
  if (!done) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Onboarding
          onComplete={() => {
            finish('people');
            setOverlayScreen('persona');
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Navigation Header */}
      <View style={styles.header}>
        {/* Left: Persona Glass Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setOverlayScreen('persona');
          }}
          style={styles.avatarBtn}
          accessibilityLabel="Open Persona Map"
        >
          <Glass size={40} art="water" zoom={280}>
            <View style={styles.avatarDot} />
          </Glass>
        </TouchableOpacity>

        {/* Center: Tabs Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTab('people');
            }}
            style={[styles.tabBtn, tab === 'people' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'people' && styles.tabTextActive]}>
              People
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTab('conversations');
            }}
            style={[styles.tabBtn, tab === 'conversations' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'conversations' && styles.tabTextActive]}>
              Conversations
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right: Memory Drawer Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setOverlayScreen('memory');
          }}
          style={styles.iconBtn}
          accessibilityLabel="Open Memory"
        >
          <Feather name="book-open" size={20} color="#18181B" />
        </TouchableOpacity>
      </View>

      {/* Main Content View */}
      <View style={styles.content}>
        {tab === 'people' ? (
          <ResidentsView
            onSelectResident={() => {
              // Could open resident profile or start a thread
            }}
          />
        ) : (
          <ConversationsView
            onOpenForceChat={() => {
              setOverlayScreen('memory');
            }}
          />
        )}
      </View>

      {/* Full-Screen Persona Modal */}
      <Modal
        visible={overlayScreen === 'persona'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOverlayScreen('none')}
      >
        <SafeAreaView style={styles.modalContainer}>
          <PersonaView
            onFindPeople={() => {
              setTab('people');
              setOverlayScreen('none');
            }}
            onClose={() => setOverlayScreen('none')}
          />
        </SafeAreaView>
      </Modal>

      {/* Full-Screen Memory Modal */}
      <Modal
        visible={overlayScreen === 'memory'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOverlayScreen('none')}
      >
        <SafeAreaView style={styles.modalContainer}>
          <MemoryView onClose={() => setOverlayScreen('none')} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF9F6',
  },
  avatarBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    borderRadius: 24,
    padding: 3,
    alignItems: 'center',
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
  },
  tabTextActive: {
    color: '#18181B',
    fontWeight: '600',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});
