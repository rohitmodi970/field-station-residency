// apps/web/utils/google-drive/client.ts
import { google } from 'googleapis';

/**
 * Google Drive OAuth2 Configuration
 */
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
];

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleDriveAuth {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

/**
 * Create OAuth2 Client
 */
export function createOAuth2Client(config: GoogleDriveConfig): InstanceType<typeof google.auth.OAuth2> {
  const { clientId, clientSecret, redirectUri } = config;
  
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

/**
 * Generate Auth URL for user consent
 */
export function generateAuthUrl(config: GoogleDriveConfig): string {
  const oauth2Client = createOAuth2Client(config);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(
  config: GoogleDriveConfig,
  code: string
): Promise<GoogleDriveAuth> {
  const oauth2Client = createOAuth2Client(config);
  
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token || undefined,
    expiry_date: tokens.expiry_date || undefined,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  config: GoogleDriveConfig,
  refreshToken: string
): Promise<GoogleDriveAuth> {
  const oauth2Client = createOAuth2Client(config);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  return {
    access_token: credentials.access_token!,
    refresh_token: credentials.refresh_token || undefined,
    expiry_date: credentials.expiry_date || undefined,
  };
}

/**
 * Upload file to Google Drive
 */
export async function uploadToGoogleDrive(
  auth: GoogleDriveAuth,
  config: GoogleDriveConfig,
  file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  },
  folderId?: string
): Promise<{
  fileId: string;
  webViewLink: string;
  webContentLink: string;
}> {
  const oauth2Client = createOAuth2Client(config);
  oauth2Client.setCredentials({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const fileMetadata: any = {
    name: file.name,
  };
  
  if (folderId) {
    fileMetadata.parents = [folderId];
  }
  
  const media = {
    mimeType: file.mimeType,
    body: require('stream').Readable.from(file.buffer),
  };
  
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });
  
  return {
    fileId: response.data.id!,
    webViewLink: response.data.webViewLink!,
    webContentLink: response.data.webContentLink!,
  };
}

/**
 * Delete file from Google Drive
 */
export async function deleteFromGoogleDrive(
  auth: GoogleDriveAuth,
  config: GoogleDriveConfig,
  fileId: string
): Promise<void> {
  const oauth2Client = createOAuth2Client(config);
  oauth2Client.setCredentials({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  await drive.files.delete({
    fileId: fileId,
  });
}

/**
 * Get file metadata from Google Drive
 */
export async function getFileMetadata(
  auth: GoogleDriveAuth,
  config: GoogleDriveConfig,
  fileId: string
): Promise<any> {
  const oauth2Client = createOAuth2Client(config);
  oauth2Client.setCredentials({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const response = await drive.files.get({
    fileId: fileId,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
  });
  
  return response.data;
}

/**
 * Download file from Google Drive
 */
export async function downloadFromGoogleDrive(
  auth: GoogleDriveAuth,
  config: GoogleDriveConfig,
  fileId: string
): Promise<Buffer> {
  const oauth2Client = createOAuth2Client(config);
  oauth2Client.setCredentials({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const response = await drive.files.get(
    {
      fileId: fileId,
      alt: 'media',
    },
    { responseType: 'arraybuffer' }
  );
  
  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Create or get app folder in Google Drive
 */
export async function getOrCreateAppFolder(
  auth: GoogleDriveAuth,
  config: GoogleDriveConfig,
  folderName: string = 'Journal App'
): Promise<string> {
  const oauth2Client = createOAuth2Client(config);
  oauth2Client.setCredentials({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  // Search for existing folder
  const searchResponse = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  
  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    return searchResponse.data.files[0]!.id!;
  }
  
  // Create folder if it doesn't exist
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  
  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
  });
  
  return folder.data.id!;
}

/**
 * List files in folder
 */
export async function listFilesInFolder(
  auth: GoogleDriveAuth,
  config: GoogleDriveConfig,
  folderId?: string
): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
}>> {
  const oauth2Client = createOAuth2Client(config);
  oauth2Client.setCredentials({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const query = folderId 
    ? `'${folderId}' in parents and trashed=false`
    : 'trashed=false';
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType, size, createdTime)',
    orderBy: 'createdTime desc',
  });
  
  return response.data.files as any[] || [];
}

/**
 * Check if user has authorized Google Drive
 */
export function isAuthorized(auth: GoogleDriveAuth | null): boolean {
  if (!auth) return false;
  
  // Check if token is expired
  if (auth.expiry_date && auth.expiry_date < Date.now()) {
    // Token expired, need refresh
    return !!auth.refresh_token;
  }
  
  return !!auth.access_token;
}

/**
 * Get default config from environment
 */
export function getDefaultConfig(): GoogleDriveConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${process.env.NEXT_PUBLIC_API_URL}/auth/google/callback`,
  };
}
