// apps/web/services/imentiv/ImentivClient.ts
// Robust HTTP client for Imentiv Emotion Intelligence API

import { getImentivConfig, ImentivConfig } from '@/config/imentiv.config';
import {
  ImentivAudioDetailsResponse,
  ImentivAudioUploadParams,
  ImentivAudioUploadResponse,
  ImentivInsightsHistoryResponse,
  ImentivInsightsMessageResponse,
  ImentivInsightsSendMessageParams,
  ImentivListAudiosParams,
  ImentivListAudiosResponse,
  ImentivMultimodalAnalyticsResponse,
  ImentivSpeakerUpdate,
  ImentivTextDetailsResponse,
  ImentivTextUploadParams,
  ImentivTextUploadResponse,
  ImentivTranscriptSegmentUpdate,
} from '@/types/imentiv.contract';

export class ImentivApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public responseBody?: unknown,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ImentivApiError';
  }
}

export class ImentivClient {
  private customConfig?: Partial<ImentivConfig>;

  constructor(customConfig?: Partial<ImentivConfig>) {
    this.customConfig = customConfig;
  }

  private getConfig(): ImentivConfig {
    return {
      ...getImentivConfig(),
      ...(this.customConfig || {}),
    };
  }

  private getHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const config = this.getConfig();
    const referer =
      process.env.IMENTIV_REFERER ||
      (config.webhookBaseUrl && config.webhookBaseUrl.startsWith('http')
        ? config.webhookBaseUrl
        : 'https://www.findmyforce.com');

    const headers: Record<string, string> = {
      'X-API-Key': config.apiKey,
      'Referer': referer,
      'is_internal': 'true',
      ...additionalHeaders,
    };
    return headers;
  }





  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const config = this.getConfig();
    if (!config.apiKey) {
      throw new ImentivApiError('IMENTIV_API_KEY is not configured', 500, null, endpoint);
    }

    const url = `${config.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = this.getHeaders(options.headers as Record<string, string>);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);


    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });




      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text().catch(() => null);
        }

        const message =
          (typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
            ? String((errorBody as { message: unknown }).message)
            : typeof errorBody === 'string'
              ? errorBody
              : `Imentiv API request failed with status ${response.status}`);

        console.error(`[ImentivClient] ${options.method || 'GET'} ${endpoint} failed (${response.status}):`, errorBody);
        throw new ImentivApiError(message, response.status, errorBody, endpoint);
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }

      return (await response.text()) as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ImentivApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ImentivApiError(`Imentiv request timed out after ${config.timeoutMs}ms`, 504, null, endpoint);
      }

      const message = error instanceof Error ? error.message : 'Network error communicating with Imentiv';
      throw new ImentivApiError(message, 500, error, endpoint);
    }
  }

  // ───────────────────────────────────────────────
  // Audio API Endpoints
  // ───────────────────────────────────────────────

  /**
   * Upload audio or video source for emotion analysis (POST /v2/audios)
   */
  async uploadAudio(params: ImentivAudioUploadParams): Promise<ImentivAudioUploadResponse> {
    const formData = new FormData();
    formData.append('title', params.title || 'Audio Recording');

    if (params.audio_file) {
      if (params.audio_file instanceof Blob || params.audio_file instanceof File) {
        formData.append('audio_file', params.audio_file);
      } else if (Buffer.isBuffer(params.audio_file)) {
        const buf = params.audio_file;
        const isMp3 =
          buf.length > 2 &&
          (buf.subarray(0, 3).toString() === 'ID3' ||
            (buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0));
        const mimeType = isMp3 ? 'audio/mpeg' : 'audio/wav';
        const fileName = isMp3 ? 'audio.mp3' : 'audio.wav';
        const blob = new Blob([new Uint8Array(buf)], { type: mimeType });
        formData.append('audio_file', blob, fileName);
      }
    } else if (params.media_url) {
      formData.append('media_url', params.media_url);
    }



    if (params.callback_url && !params.callback_url.includes('localhost') && !params.callback_url.includes('127.0.0.1')) {
      formData.append('callback_url', params.callback_url);
    }

    if (params.description) {
      formData.append('description', params.description);
    }

    if (params.start_millis !== undefined) {
      formData.append('start_millis', String(params.start_millis));
    }

    if (params.end_millis !== undefined) {
      formData.append('end_millis', String(params.end_millis));
    }

    const diarizationVal = String(params.diarization ?? params.speaker_diarization ?? true);
    formData.append('diarization', diarizationVal);

    const textEmotionVal = String(params.text_emotion ?? params.text_emotion_analysis ?? true);
    formData.append('text_emotion', textEmotionVal);

    const transcriptionVal = String(params.transcription ?? true);
    formData.append('transcription', transcriptionVal);


    if (params.language) {
      formData.append('language', params.language);
    }
    if (params.transcript) {
      formData.append('transcript', params.transcript);
    }
    if (params.transcript_format) {
      formData.append('transcript_format', params.transcript_format);
    }
    if (params.transcript_offset_millis !== undefined) {
      formData.append('transcript_offset_millis', String(params.transcript_offset_millis));
    }

    // Do not set Content-Type header manually for FormData so boundary is generated automatically
    const headers = this.getHeaders();
    delete (headers as Record<string, string | undefined>)['Content-Type'];

    return this.request<ImentivAudioUploadResponse>('/v2/audios', {
      method: 'POST',
      body: formData,
      headers,
    });
  }

  /**
   * List processed audios with cursor pagination (GET /v1/audios)
   */
  async listAudios(params?: ImentivListAudiosParams): Promise<ImentivListAudiosResponse> {
    const query = new URLSearchParams();
    if (params?.offset_audio_id) query.append('offset_audio_id', params.offset_audio_id);
    if (params?.page_size) query.append('page_size', String(params.page_size));
    if (params?.direction) query.append('direction', params.direction);

    const queryString = query.toString();
    const endpoint = queryString ? `/v1/audios?${queryString}` : '/v1/audios';
    return this.request<ImentivListAudiosResponse>(endpoint, { method: 'GET' });
  }

  /**
   * Get single audio emotion insights and status (GET /v2/audios/{audio_id} or fallback to /v1/audios/{audio_id})
   */
  async getAudioDetails(audioId: string): Promise<ImentivAudioDetailsResponse> {
    if (!audioId) throw new ImentivApiError('audio_id is required', 400);
    try {
      return await this.request<ImentivAudioDetailsResponse>(`/v2/audios/${encodeURIComponent(audioId)}`, {
        method: 'GET',
      });
    } catch {
      return this.request<ImentivAudioDetailsResponse>(`/v1/audios/${encodeURIComponent(audioId)}`, {
        method: 'GET',
      });
    }
  }

  /**
   * Get V2 Audio Details (GET /v2/audios/{audio_id})
   */
  async getAudioDetailsV2(audioId: string): Promise<any> {
    if (!audioId) throw new ImentivApiError('audio_id is required', 400);
    return this.request<any>(`/v2/audios/${encodeURIComponent(audioId)}`, {
      method: 'GET',
    });
  }

  /**
   * Get fine-grained media processing status (GET /v2/{media_type}/{media_id}/statuses)
   */
  async getMediaStatuses(mediaType: 'videos' | 'audios' | 'texts' | 'images', mediaId: string): Promise<any> {
    if (!mediaId) throw new ImentivApiError('media_id is required', 400);
    return this.request<any>(`/v2/${mediaType}/${encodeURIComponent(mediaId)}/statuses?status=true&speech_status=true`, {
      method: 'GET',
    });
  }


  /**
   * Get complete multimodal analytics for audio (speaker breakdowns + transcript emotions)
   * (GET /v2/audios/{audio_id}/multimodal-analytics)
   */
  async getMultimodalAnalytics(audioId: string): Promise<ImentivMultimodalAnalyticsResponse> {
    if (!audioId) throw new ImentivApiError('audio_id is required', 400);
    return this.request<ImentivMultimodalAnalyticsResponse>(
      `/v2/audios/${encodeURIComponent(audioId)}/multimodal-analytics`,
      { method: 'GET' }
    );
  }

  /**
   * Reprocess an audio file (PUT /v1/audios/{audio_id})
   */
  async reprocessAudio(
    audioId: string,
    options?: { callback_url?: string; reprocess?: boolean }
  ): Promise<{ id: string; status: string; message: string }> {
    const params = new URLSearchParams();
    if (options?.callback_url) params.append('callback_url', options.callback_url);
    params.append('reprocess', String(options?.reprocess !== undefined ? options.reprocess : true));

    return this.request<{ id: string; status: string; message: string }>(
      `/v1/audios/${encodeURIComponent(audioId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );
  }

  /**
   * Delete an audio record (DELETE /v1/audios/{audio_id})
   */
  async deleteAudio(audioId: string): Promise<{ id: string; status: string }> {
    return this.request<{ id: string; status: string }>(`/v1/audios/${encodeURIComponent(audioId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Download audio emotion report (GET /v1/audios/{audio_id}/report)
   */
  async downloadAudioReport(audioId: string): Promise<unknown> {
    return this.request<unknown>(`/v1/audios/${encodeURIComponent(audioId)}/report`, {
      method: 'GET',
    });
  }

  /**
   * Update audio transcript segments (PUT /v1/audios/{audio_id}/transcript)
   */
  async updateTranscript(
    audioId: string,
    segments: ImentivTranscriptSegmentUpdate[]
  ): Promise<ImentivTranscriptSegmentUpdate[]> {
    return this.request<ImentivTranscriptSegmentUpdate[]>(
      `/v1/audios/${encodeURIComponent(audioId)}/transcript`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segments),
      }
    );
  }

  /**
   * Update speaker names (PUT /v1/audios/{audio_id}/speakers/names)
   */
  async updateSpeakerNames(
    audioId: string,
    speakers: ImentivSpeakerUpdate[]
  ): Promise<{ speakers: ImentivSpeakerUpdate[] }> {
    return this.request<{ speakers: ImentivSpeakerUpdate[] }>(
      `/v1/audios/${encodeURIComponent(audioId)}/speakers/names`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(speakers),
      }
    );
  }

  // ───────────────────────────────────────────────
  // Text Emotion API Endpoints
  // ───────────────────────────────────────────────

  /**
   * Submit text content for emotion analysis across 28 categories (POST /v2/texts)
   */
  async uploadText(params: ImentivTextUploadParams): Promise<ImentivTextUploadResponse> {
    const formData = new FormData();
    if (params.title) formData.append('title', params.title);
    if (params.text) formData.append('text', params.text);
    if (params.text_url) formData.append('text_url', params.text_url);
    if (params.text_file) {
      if (params.text_file instanceof Blob || params.text_file instanceof File) {
        formData.append('text_file', params.text_file);
      } else if (Buffer.isBuffer(params.text_file)) {
        const blob = new Blob([new Uint8Array(params.text_file)], { type: 'text/plain' });
        formData.append('text_file', blob, 'text.txt');
      }
    }
    if (params.callback_url) formData.append('callback_url', params.callback_url);

    const headers = this.getHeaders();
    delete (headers as Record<string, string | undefined>)['Content-Type'];

    return this.request<ImentivTextUploadResponse>('/v2/texts', {
      method: 'POST',
      body: formData,
      headers,
    });
  }

  /**
   * Get text emotion insights results (GET /v1/texts/{text_id})
   */
  async getTextDetails(textId: string): Promise<ImentivTextDetailsResponse> {
    return this.request<ImentivTextDetailsResponse>(`/v1/texts/${encodeURIComponent(textId)}`, {
      method: 'GET',
    });
  }

  // ───────────────────────────────────────────────
  // Conversational Insights API Endpoints
  // ───────────────────────────────────────────────

  /**
   * Send message to conversational Insights endpoint (POST /v2/{media_type}/{media_id}/insights)
   */
  async sendMessageToInsights(
    params: ImentivInsightsSendMessageParams
  ): Promise<ImentivInsightsMessageResponse> {
    const stream = params.stream !== undefined ? params.stream : false;
    return this.request<ImentivInsightsMessageResponse>(
      `/v2/${encodeURIComponent(params.media_type)}/${encodeURIComponent(params.media_id)}/insights?stream=${stream}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: params.message }),
      }
    );
  }

  /**
   * Retrieve conversational insights history (GET /v2/{media_type}/{media_id}/insights)
   */
  async getInsightsHistory(
    mediaType: 'video' | 'audio' | 'image' | 'text',
    mediaId: string
  ): Promise<ImentivInsightsHistoryResponse> {
    return this.request<ImentivInsightsHistoryResponse>(
      `/v2/${encodeURIComponent(mediaType)}/${encodeURIComponent(mediaId)}/insights`,
      { method: 'GET' }
    );
  }

  /**
   * Delete conversational insights history (DELETE /v2/{media_type}/{media_id}/insights)
   */
  async deleteInsightsHistory(
    mediaType: 'video' | 'audio' | 'image' | 'text',
    mediaId: string
  ): Promise<void> {
    return this.request<void>(
      `/v2/${encodeURIComponent(mediaType)}/${encodeURIComponent(mediaId)}/insights`,
      { method: 'DELETE' }
    );
  }
}

export const imentivClient = new ImentivClient();
