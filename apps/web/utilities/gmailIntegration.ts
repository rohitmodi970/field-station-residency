export async function initiateGmailConnect(): Promise<{ authUrl?: string; error?: string }> {
  try {
    const response = await fetch('/api/auth/google-gmail/connect');
    if (!response.ok) {
      return { error: 'Failed to initiate Gmail connection' };
    }
    const data = await response.json();
    return { authUrl: data.authUrl };
  } catch {
    return { error: 'Failed to initiate Gmail connection' };
  }
}

export function redirectToGmailAuth() {
  initiateGmailConnect().then(({ authUrl, error }) => {
    if (error) {
      alert(error);
      return;
    }
    if (authUrl) {
      window.location.href = authUrl;
    }
  });
}

export async function disconnectGmail(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/google-gmail/disconnect', { method: 'POST' });
    if (!response.ok) {
      return { success: false, error: 'Failed to disconnect Gmail' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to disconnect Gmail' };
  }
}

export async function getGmailStatus(): Promise<{
  connected: boolean;
  syncEnabled: boolean;
  email?: string;
  needsReauth?: boolean;
  error?: string;
}> {
  try {
    const response = await fetch('/api/gmail/status');
    if (!response.ok) {
      return { connected: false, syncEnabled: false };
    }
    return await response.json();
  } catch {
    return { connected: false, syncEnabled: false };
  }
}
