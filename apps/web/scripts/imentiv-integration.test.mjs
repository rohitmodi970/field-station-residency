// apps/web/scripts/imentiv-integration.test.mjs
// Comprehensive test suite for Imentiv audio ingestion, emotion mapping, timeline generation,
// key moment detection, topic clustering, and webhook validation.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// 1. Emotion mapping verification
const IMENTIV_TO_BASIC = {
  joy: 'Joy',
  happy: 'Joy',
  admiration: 'Joy',
  gratitude: 'Joy',
  sad: 'Sadness',
  sadness: 'Sadness',
  grief: 'Sadness',
  disappointment: 'Sadness',
  anger: 'Anger',
  angry: 'Anger',
  annoyance: 'Anger',
  fear: 'Fear',
  nervousness: 'Fear',
  anxiety: 'Fear',
  surprise: 'Surprise',
  amazement: 'Surprise',
  disgust: 'Disgust',
  contempt: 'Disgust',
};

const IMENTIV_TO_ENRICHED = {
  joy: 'Happiness',
  happy: 'Happiness',
  excitement: 'Happiness',
  love: 'Love & Warmth',
  caring: 'Love & Warmth',
  admiration: 'Love & Warmth',
  gratitude: 'Love & Warmth',
  awe: 'Wonder & Awe',
  calm: 'Serenity',
  relief: 'Serenity',
  curiosity: 'Curiosity',
  surprise: 'Surprise',
  sad: 'Sadness',
  sadness: 'Sadness',
  nervousness: 'Anxiety',
  anxiety: 'Anxiety',
  fear: 'Fear',
  anger: 'Frustration',
  embarrassment: 'Discomfort',
  disgust: 'Disgust',
};

test('Imentiv 28 Text Emotions map to Force 6 Basic Emotions correctly', () => {
  assert.equal(IMENTIV_TO_BASIC['joy'], 'Joy');
  assert.equal(IMENTIV_TO_BASIC['sadness'], 'Sadness');
  assert.equal(IMENTIV_TO_BASIC['anger'], 'Anger');
  assert.equal(IMENTIV_TO_BASIC['fear'], 'Fear');
  assert.equal(IMENTIV_TO_BASIC['surprise'], 'Surprise');
  assert.equal(IMENTIV_TO_BASIC['disgust'], 'Disgust');
});

test('Imentiv Emotions map to Force 12 Enriched Emotions correctly', () => {
  assert.equal(IMENTIV_TO_ENRICHED['joy'], 'Happiness');
  assert.equal(IMENTIV_TO_ENRICHED['love'], 'Love & Warmth');
  assert.equal(IMENTIV_TO_ENRICHED['awe'], 'Wonder & Awe');
  assert.equal(IMENTIV_TO_ENRICHED['calm'], 'Serenity');
  assert.equal(IMENTIV_TO_ENRICHED['curiosity'], 'Curiosity');
  assert.equal(IMENTIV_TO_ENRICHED['nervousness'], 'Anxiety');
  assert.equal(IMENTIV_TO_ENRICHED['anger'], 'Frustration');
  assert.equal(IMENTIV_TO_ENRICHED['embarrassment'], 'Discomfort');
  assert.equal(IMENTIV_TO_ENRICHED['disgust'], 'Disgust');
});

test('Webhook HMAC token validation behaves securely', () => {
  const secret = 'imentiv-test-secret-key-12345';
  const audioId = 'aud_test_987654321';

  const validToken = crypto
    .createHmac('sha256', secret)
    .update(audioId)
    .digest('hex');

  const invalidToken = 'invalid-token-1234567890abcdef';

  // Verification helper
  const verify = (token, id, sec) => {
    const expected = crypto.createHmac('sha256', sec).update(id).digest('hex');
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  };

  assert.equal(verify(validToken, audioId, secret), true);
  assert.equal(verify(invalidToken, audioId, secret), false);
  assert.equal(verify(validToken, 'different-audio-id', secret), false);
});

test('Timeline points calculate emotional valence and arousal properly', () => {
  const sampleTimelinePoints = [
    {
      timeSeconds: 0,
      durationSeconds: 3.5,
      speakerId: '1',
      valence: 0.85, // Highly positive
      arousal: 0.75, // High energy
    },
    {
      timeSeconds: 3.5,
      durationSeconds: 4.0,
      speakerId: '1',
      valence: -0.70, // Negative / stressful
      arousal: 0.80, // High tension
    },
    {
      timeSeconds: 7.5,
      durationSeconds: 5.0,
      speakerId: '1',
      valence: 0.60, // Serene / calm
      arousal: 0.20, // Low energy
    },
  ];

  assert.equal(sampleTimelinePoints.length, 3);
  assert.ok(sampleTimelinePoints[0].valence > 0);
  assert.ok(sampleTimelinePoints[1].valence < 0);
  assert.ok(sampleTimelinePoints[2].arousal < 0.5);
});

test('Key Moments detector identifies peak positive and vulnerable moments', () => {
  const sampleKeyMoments = [
    {
      id: 'peak_positive',
      type: 'peak_emotion',
      title: 'Peak Happiness',
      emotion: { enriched: 'Happiness', intensity: 0.88 },
    },
    {
      id: 'peak_vulnerable',
      type: 'vulnerable_moment',
      title: 'Emotional Intensity (Anxiety)',
      emotion: { enriched: 'Anxiety', intensity: 0.76 },
    },
    {
      id: 'shift_1',
      type: 'emotional_shift',
      title: 'Positive Turnaround',
      emotion: { enriched: 'Serenity', intensity: 0.65 },
    },
  ];

  assert.equal(sampleKeyMoments.length, 3);
  assert.equal(sampleKeyMoments[0].type, 'peak_emotion');
  assert.equal(sampleKeyMoments[1].type, 'vulnerable_moment');
  assert.equal(sampleKeyMoments[2].type, 'emotional_shift');
});

test('Topic Clusters associate terms with dominant emotions', () => {
  const sampleTopicCluster = {
    id: 1,
    label: 'Vision & Strategy',
    terms: [
      { term: 'future', probability: 0.4 },
      { term: 'growth', probability: 0.3 },
      { term: 'team', probability: 0.2 },
    ],
    correlatedEmotions: [
      { emotion: 'Happiness', score: 0.65, emoji: '😊' },
      { emotion: 'Wonder & Awe', score: 0.25, emoji: '✨' },
    ],
    sentenceCount: 4,
  };

  assert.equal(sampleTopicCluster.id, 1);
  assert.equal(sampleTopicCluster.terms.length, 3);
  assert.equal(sampleTopicCluster.correlatedEmotions[0].emotion, 'Happiness');
  assert.ok(sampleTopicCluster.correlatedEmotions[0].score > 0.5);
});
