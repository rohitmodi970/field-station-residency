// Utility function to generate embeddings for a journal entry
export async function generateJournalEmbedding(entryId: string, content: string, title: string = '', threshold: number = 0.75) {
  try {
    const response = await fetch('/api/journal-embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entryId,
        content,
        title, // Pass title for category extraction
        threshold
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate embedding');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating journal embedding:', error);
    throw error;
  }
}

// Function to fetch mindmap data for specific entries
export async function fetchMindmapData(entryIds: string[]) {
  try {
    const queryString = entryIds.length > 0 ? `?entryIds=${entryIds.join(',')}` : '';
    const response = await fetch(`/api/journal-embeddings${queryString}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch mindmap data');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching mindmap data:', error);
    throw error;
  }
}
