import axios from 'axios';

export async function analyzeSentimentQuick(formData: FormData) {
  const response = await fetch('/api/analysis/text/single?mode=sentiment_quick', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to analyze sentiment');
  }

  return response.json();
}

export async function analyzeSingleJournal(input: {
  journalId: string;
  decrypted_title?: string;
  decrypted_content?: string;
  analysis_type: 'sentiment' | 'textual' | 'combined';
}) {
  const response = await fetch('/api/analysis/text/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to analyze journal entry');
  }

  return response.json();
}

export async function analyzeMultiText(payload: Record<string, unknown>) {
  const response = await fetch('/api/analysis/text/multi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to run multi analysis');
  }

  return response.json();
}

export async function analyzeVoiceAudio(formData: FormData) {
  const response = await axios.post('/api/analysis/audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });

  return response.data;
}
