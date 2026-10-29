
export interface MediaItem {
  id: string;
  user_id: string;
  media_type: 'image' | 'audio' | 'video' | 'document';
  file_name: string;
  file_size: number;
  mime_type: string;
  bucket: string;
  folder: 'mydrive' | 'journal' | 'onboarding';
  path: string;
  public_url: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail_url?: string;
  upload_status: 'uploading' | 'completed' | 'failed';
  processed: boolean;
  is_encrypted: boolean;
  encryption_iv?: string;
  original_mime_type?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface VaultStats {
  total_files: number;
  total_size: number;
  total_size_mb: string;
  by_type: {
    image: number;
    audio: number;
    video: number;
    document: number;
  };
  by_folder: {
    mydrive: number;
    journal: number;
    onboarding: number;
  };
  folder_usage: {
    mydrive_mb: string;
    journal_mb: string;
    onboarding_mb: string;
  };
  last_upload?: string;
}
export interface VaultStatsData {
  total_files: number;
  total_size: number;
  total_size_mb: string;
  storage_limit_mb: number;
  remaining_mb: string;
  usage_percentage: string;
  is_near_limit: boolean;
  by_type: {
    image: number;
    audio: number;
    video: number;
    document: number;
  };
  by_folder: {
    mydrive: number;
    journal: number;
    onboarding: number;
  };
  folder_usage: {
    mydrive_mb: string;
    journal_mb: string;
    onboarding_mb: string;
  };
}
export interface UploadOptions {
  folder: 'mydrive'; // Only mydrive uploads allowed
  is_encrypted?: boolean;
  encryption_iv?: string;
  metadata?: Record<string, any>;
  width?: number;
  height?: number;
  duration?: number;
}