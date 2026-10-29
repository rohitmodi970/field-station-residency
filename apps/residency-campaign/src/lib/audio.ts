/**
 * Modern Audio Layer for Expo SDK 54 (expo-audio)
 * Native microphone recording, live metering for ripples, and audio playback.
 */
import { AudioModule, AudioRecorder, RecordingPresets, createAudioPlayer } from 'expo-audio';

export interface RecorderCallbacks {
  onLevel?: (level: number) => void; // Normalized 0.0 to 1.0
  onError?: (err: any) => void;
}

export class ResidencyAudioManager {
  private recorder: AudioRecorder | null = null;
  private player: any = null;
  private isRecording = false;

  async requestPermissions(): Promise<boolean> {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      return status.granted;
    } catch {
      return false;
    }
  }

  async startRecording(callbacks?: RecorderCallbacks): Promise<boolean> {
    try {
      const granted = await this.requestPermissions();
      if (!granted) {
        callbacks?.onError?.(new Error("Microphone permission denied"));
        return false;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      this.recorder = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
      this.recorder.addListener('recordingStatusUpdate', (status: any) => {
        if (status?.metering !== undefined) {
          // Normalize dBFS (-60dB to 0dB) into [0.0, 1.0]
          const rawDb = status.metering;
          const level = Math.max(0, Math.min(1, (rawDb + 60) / 60));
          callbacks?.onLevel?.(level);
        }
      });

      await this.recorder.prepareToRecordAsync();
      this.recorder.record();
      this.isRecording = true;
      return true;
    } catch (err) {
      console.warn("[ResidencyAudio] Error starting recording:", err);
      callbacks?.onError?.(err);
      this.isRecording = false;
      return false;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recorder || !this.isRecording) return null;
    try {
      this.isRecording = false;
      await this.recorder.stop();
      const uri = this.recorder.uri || null;
      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      return uri;
    } catch (err) {
      console.warn("[ResidencyAudio] Error stopping recording:", err);
      return null;
    }
  }

  async playAudio(uri: string, onFinish?: () => void) {
    try {
      if (this.player) {
        await this.player.stop();
        this.player = null;
      }

      this.player = createAudioPlayer(uri);
      this.player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.didJustFinish) {
          onFinish?.();
        }
      });
      await this.player.play();
    } catch (err) {
      console.warn("[ResidencyAudio] Error playing audio:", err);
      onFinish?.();
    }
  }

  async stopPlayback() {
    try {
      if (this.player) {
        await this.player.stop();
        this.player = null;
      }
    } catch {}
  }
}

export const audioManager = new ResidencyAudioManager();
