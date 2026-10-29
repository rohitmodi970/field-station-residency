export const revokeBlobUrl = (url?: string) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

export const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const maybeResponse = (error as { response?: { status?: unknown } }).response;
  return typeof maybeResponse?.status === 'number' ? maybeResponse.status : undefined;
};
