import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import PaintedMark from '../f/PaintedMark';
import Glass from '../f/Glass';
import VoiceMode from '../f/VoiceMode';
import { ForceBubble, UserBubble, TypingDots } from '../f/Bubbles';
import { NameField, LinkList, OnairosCard } from './Links';
import { useResidencyStore } from '../../stores/residencyStore';
import { QUESTIONS } from '../../data/residency';
import type { Clip } from '../../data/mira';

type Step = 'splash' | 'connect' | 'talk';

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('splash');
  const [currentQ, setCurrentQ] = useState(0);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const { name, answers, clips, read, sync } = useResidencyStore();
  const [localAnswers, setLocalAnswers] = useState<string[]>([]);
  const [localClips, setLocalClips] = useState<Clip[]>([]);

  // Advance from Splash
  const handleSplashDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('connect');
  };

  // Advance from Connect
  const handleConnectDone = () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('talk');
  };

  // Submit Answer for Current Question
  const handleAnswerSubmit = async (answerText: string, audioUri?: string | null) => {
    const nextAnswers = [...localAnswers, answerText];
    setLocalAnswers(nextAnswers);

    if (audioUri) {
      const clip: Clip = {
        id: `clip-${Date.now()}`,
        name: `Answer ${currentQ + 1}`,
        secs: 14,
        transcript: answerText,
        src: audioUri,
      };
      setLocalClips((prev) => [...prev, clip]);
    }

    if (currentQ < QUESTIONS.length - 1) {
      setIsThinking(true);
      setTimeout(() => {
        setIsThinking(false);
        setCurrentQ((prev) => prev + 1);
      }, 700);
    } else {
      // Finished all 3 questions!
      setIsThinking(true);
      await read(nextAnswers, localClips);
      setTimeout(() => {
        setIsThinking(false);
        onComplete();
      }, 1200);
    }
  };

  // Stop Voice Mode
  const handleVoiceFinish = (audioUri: string | null) => {
    setIsVoiceOpen(false);
    const mockTranscript =
      currentQ === 0
        ? "Building decentralized compute infrastructure for solar microgrids."
        : currentQ === 1
        ? "The hardware battery interface and talking directly to technicians."
        : "Leaving with two co-conspirators who understand distributed grid dynamics.";
    handleAnswerSubmit(mockTranscript, audioUri);
  };

  const handleTypedSubmit = () => {
    if (!typedAnswer.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleAnswerSubmit(typedAnswer.trim());
    setTypedAnswer('');
    setIsTypingMode(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* STEP 1: SPLASH */}
      {step === 'splash' && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleSplashDone}
          style={styles.splashContainer}
        >
          <PaintedMark size={236} onDone={handleSplashDone} />
          <Text style={styles.splashTagline}>
            A companion that builds your longitudinal memory and helps you find your cohort.
          </Text>
        </TouchableOpacity>
      )}

      {/* STEP 2: CONNECT */}
      {step === 'connect' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex1}
        >
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.connectContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.connectHeader}>
              <Text style={styles.connectTitle}>Connect what's yours</Text>
              <Text style={styles.connectSubtitle}>
                Force reads your links and online presence to start building your residency persona.
              </Text>
            </View>

            <NameField />
            <OnairosCard />
            <View style={{ height: 16 }} />
            <LinkList />

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!name.trim()}
              onPress={handleConnectDone}
              style={[
                styles.primaryBtn,
                !name.trim() && styles.primaryBtnDisabled,
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {name.trim() ? 'Continue' : 'Enter your name to continue'}
              </Text>
              {name.trim() && <Feather name="arrow-right" size={18} color="#FAF9F6" />}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* STEP 3: TALK */}
      {step === 'talk' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex1}
        >
          <View style={styles.talkContainer}>
            {/* Conversation Stream */}
            <ScrollView
              style={styles.flex1}
              contentContainerStyle={styles.talkScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <ForceBubble
                text={`Hi ${name.trim() || 'Resident'}. Three questions about you and the residency.`}
              />

              {/* Show completed Q&A pairs */}
              {localAnswers.map((ans, idx) => (
                <React.Fragment key={idx}>
                  <ForceBubble text={QUESTIONS[idx]} />
                  <UserBubble text={ans} clip={localClips[idx]} />
                </React.Fragment>
              ))}

              {/* Show current question if not finished */}
              {currentQ < QUESTIONS.length && localAnswers.length === currentQ && (
                <ForceBubble text={QUESTIONS[currentQ]} />
              )}

              {isThinking && <TypingDots />}
            </ScrollView>

            {/* Answer Control Dock */}
            <View style={styles.dock}>
              {isTypingMode ? (
                <View style={styles.typeRow}>
                  <TextInput
                    value={typedAnswer}
                    onChangeText={setTypedAnswer}
                    placeholder="Type your reflection…"
                    placeholderTextColor="#A1A1AA"
                    style={styles.typeInput}
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={handleTypedSubmit}
                    disabled={!typedAnswer.trim()}
                    style={[styles.sendBtn, !typedAnswer.trim() && { opacity: 0.4 }]}
                  >
                    <Feather name="arrow-up" size={18} color="#FAF9F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsTypingMode(false)}
                    style={styles.micToggleBtn}
                  >
                    <Feather name="mic" size={18} color="#52525B" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.micDock}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setIsVoiceOpen(true)}
                    style={styles.micOrbWrapper}
                  >
                    <Glass size={64} art="water" zoom={260}>
                      <Feather name="mic" size={24} color="#18181B" />
                    </Glass>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIsTypingMode(true)}
                    style={styles.typeInsteadBtn}
                  >
                    <Text style={styles.typeInsteadText}>Type instead</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Full-screen Voice Ripple Overlay (over top of chat without hiding it) */}
          <VoiceMode
            visible={isVoiceOpen}
            onFinish={handleVoiceFinish}
            onCancel={() => setIsVoiceOpen(false)}
          />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  flex1: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  splashTagline: {
    fontSize: 16,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 24,
    maxWidth: 280,
  },
  connectContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  connectHeader: {
    marginBottom: 20,
  },
  connectTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.4,
  },
  connectSubtitle: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 6,
    lineHeight: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#18181B',
    height: 56,
    borderRadius: 28,
    marginTop: 20,
  },
  primaryBtnDisabled: {
    backgroundColor: '#E4E4E7',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FAF9F6',
  },
  talkContainer: {
    flex: 1,
  },
  talkScrollContent: {
    paddingVertical: 16,
    paddingBottom: 100,
  },
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(250, 249, 246, 0.94)',
    alignItems: 'center',
  },
  micDock: {
    alignItems: 'center',
  },
  micOrbWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  typeInsteadBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  typeInsteadText: {
    fontSize: 13,
    color: '#71717A',
    fontWeight: '500',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  typeInput: {
    flex: 1,
    fontSize: 15,
    color: '#18181B',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#18181B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micToggleBtn: {
    padding: 6,
  },
});
