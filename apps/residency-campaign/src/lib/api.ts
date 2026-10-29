import axios from 'axios';

// Default to backend host or production URL
export const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://www.findmyforce.com';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface SaveParticipantPayload {
  uniqueId?: string;
  name?: string;
  email?: string | null;
  links?: Record<string, string>;
  extraLinks?: string[];
  onairosStatus?: string;
  onairosData?: any;
  answers?: string[];
  audioClips?: any[];
  personaPoints?: any[];
  agreedPoints?: string[];
  removedFound?: string[];
  fit?: string | null;
}

export const residencyApi = {
  async save(payload: SaveParticipantPayload) {
    const res = await apiClient.post('/api/residency/save', payload);
    return res.data;
  },

  async analyze(params: {
    answers: string[];
    name?: string;
    uniqueId?: string;
    links?: Record<string, string>;
    onairosData?: any;
  }) {
    const res = await apiClient.post('/api/residency/analyze', params);
    return res.data;
  },

  async getParticipant(identifier: { uniqueId?: string; email?: string; token?: string }) {
    const { uniqueId, email, token } = identifier;
    const params = new URLSearchParams();
    if (uniqueId) params.set('unique_id', uniqueId);
    if (email) params.set('email', email);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await apiClient.get(`/api/residency/participant?${params.toString()}`, { headers });
    return res.data;
  },

  async uploadAudio(fileUri: string, uniqueId: string, questionIndex: number) {
    const formData = new FormData();
    const filename = `recording_q${questionIndex + 1}_${Date.now()}.m4a`;
    
    // @ts-ignore: React Native FormData file shape
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: 'audio/m4a',
    });
    formData.append('uniqueId', uniqueId);
    formData.append('questionIndex', String(questionIndex));

    const res = await apiClient.post('/api/residency/upload-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async enrich(payload: { name: string; uniqueId: string; links: Record<string, string> }) {
    const res = await apiClient.post('/api/residency/enrich', payload);
    return res.data;
  },
};
