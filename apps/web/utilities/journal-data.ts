// Function to fetch all journal entries from the API
import { JournalEntry } from "@/components/Journal/types";
import { decryptJournalEntry } from "@/utils/encryption/journalEncryption";
import { getEncryptionKey } from "@/utils/encryption/keyManager";
import { ensureEncryptionReady, type EncryptionReadinessResult } from "@/utils/encryption";
import { decryptText } from "@/utils/encryption/crypto";
import { resolveJournalDisplayFields } from "@/utilities/journalTitle";

export interface JournalEntriesResult {
  entries: JournalEntry[];
  encryptionStatus: EncryptionReadinessResult;
}

const resolveEncryptionStatus = async (entries: any[]): Promise<EncryptionReadinessResult> => {
  const primaryUserId = entries.find((entry) => typeof entry.user_id === "string")?.user_id as
    | string
    | undefined;
  if (!primaryUserId) {
    return { ready: false, status: "needs_unlock", reason: "missing_user" };
  }

  return ensureEncryptionReady({ userId: primaryUserId });
};

const buildLockedContent = () => ({
  title: "🔒 Locked Entry",
  content: "This entry is encrypted. Please unlock your encryption to view this content.",
});

/**
 * Fetch all journal entries excluding archived ones
 * Use this for dashboard, my-diary, and recent entries
 */
export const getAllJournalEntriesWithStatus = async (): Promise<JournalEntriesResult> => {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(
      `${baseUrl}/api/journals?limit=1000&sortBy=display_date&sortOrder=desc&include_media=true&is_archived=false`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch journal entries");
    }

    const data = await response.json();
    const entries = data.journals || [];

    const encryptionStatus = await resolveEncryptionStatus(entries);
    const encryptionReady = encryptionStatus.ready;

    const transformedEntries = await Promise.all(
      entries.map(async (entry: any) => {
        let title = entry.title || "";
        let content = entry.content || "";
        let voiceTranscript = "";

        if (entry.is_encrypted && entry.title_encrypted && entry.content_encrypted) {
          if (encryptionReady) {
            try {
              const decrypted = await decryptJournalEntry(
                {
                  title_encrypted: entry.title_encrypted,
                  title_iv: entry.title_iv,
                  content_encrypted: entry.content_encrypted,
                  content_iv: entry.content_iv,
                  date: entry.date || "",
                  is_favorite: entry.is_favorite || false,
                  is_archived: entry.is_archived || false,
                  journal_type: entry.journal_type,
                  mood: entry.mood,
                  tags: entry.tags,
                  location: entry.location,
                  weather: entry.weather,
                },
                entry.user_id
              );

              title = decrypted.title || "";
              content = decrypted.content || "";
            } catch (decryptError) {
              console.warn(
                "[getAllJournalEntries] Decryption failed for entry:",
                entry.journal_id,
                decryptError
              );
              ({ title, content } = buildLockedContent());
            }
          } else {
            ({ title, content } = buildLockedContent());
          }
        }

        if (
          encryptionReady &&
          entry.voice_transcript_encrypted &&
          entry.voice_transcript_iv &&
          typeof entry.user_id === "string"
        ) {
          try {
            const key = await getEncryptionKey(entry.user_id);
            voiceTranscript = await decryptText(
              entry.voice_transcript_encrypted,
              entry.voice_transcript_iv,
              key
            );
          } catch (voiceDecryptError) {
            console.warn(
              "[getAllJournalEntries] Voice transcript decryption failed for entry:",
              entry.journal_id,
              voiceDecryptError
            );
            voiceTranscript = "";
          }
        }

        const mediaByType = {
          image: [] as any[],
          audio: [] as any[],
          video: [] as any[],
          document: [] as any[],
        };

        if (entry.journal_media && Array.isArray(entry.journal_media)) {
          entry.journal_media.forEach((media: any) => {
            const type = media.media_type as "image" | "audio" | "video" | "document";
            if (mediaByType[type]) {
              mediaByType[type].push(media);
            }
          });
        }

        const mediaTypes = Object.keys(mediaByType).filter(
          (key) => mediaByType[key as keyof typeof mediaByType].length > 0
        );

        const resolved = resolveJournalDisplayFields({
          title,
          date: entry.date || entry.created_at,
          hasVoiceMedia:
            mediaTypes.includes("audio") ||
            Boolean(entry.voice_transcript_encrypted) ||
            Boolean(entry.voice_transcript_source_signature) ||
            Boolean(entry.voice_transcript_generated_at),
          content,
          transcript: voiceTranscript,
        });

        return {
          id: entry.id,
          journalId: entry.journal_id,
          title: resolved.title,
          content: resolved.content,
          resolvedContent: resolved.content,
          contentSource: resolved.contentSource,
          voiceTranscript,
          date: entry.date || "",
          displayDate: entry.display_date || entry.created_at,
          tags: entry.tags || [],
          mood: entry.mood || null,
          journalType: entry.journal_type || "",
          timestamp: entry.created_at,
          userId: entry.user_id,
          mediaType: mediaTypes,
          mediaUrl: {
            image: mediaByType.image.map((img: any) => img.public_url || img.thumbnail_url || ""),
            audio: mediaByType.audio.map((audio: any) => audio.public_url || ""),
            video: mediaByType.video.map((video: any) => video.public_url || video.thumbnail_url || ""),
            document: mediaByType.document.map((doc: any) => doc.public_url || ""),
          },
          fileName: entry.file_name || "",
          fileSize: entry.file_size || 0,
          createdAt: entry.created_at || "",
          updatedAt: entry.updated_at || "",
          isFavorite: entry.is_favorite || false,
          isArchived: entry.is_archived || false,
          wordCount: entry.word_count || 0,
          readingTimeMinutes: entry.reading_time_minutes || 0,
        };
      })
    );

    return { entries: transformedEntries, encryptionStatus };
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return {
      entries: [],
      encryptionStatus: { ready: false, status: "error", reason: "fetch_failed" },
    };
  }
};

export const getAllJournalEntries = async (): Promise<JournalEntry[]> => {
  const result = await getAllJournalEntriesWithStatus();
  return result.entries;
};

/**
 * Fetch ALL journal entries including archived ones
 * Use this ONLY for the main journal page where archived entries should be visible
 */
export const getAllJournalEntriesIncludingArchivedWithStatus = async (
  includeMedia: boolean = false,
  limit: number = 100
): Promise<JournalEntriesResult> => {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(
      `${baseUrl}/api/journals?limit=${limit}&sortBy=display_date&sortOrder=desc&include_media=${includeMedia}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "max-age=60",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch journal entries");
    }

    const data = await response.json();
    const entries = data.journals || [];

    const encryptionStatus = await resolveEncryptionStatus(entries);
    const encryptionReady = encryptionStatus.ready;

    const transformedEntries = await Promise.all(
      entries.map(async (entry: any) => {
        let title = entry.title || "";
        let content = entry.content || "";
        let voiceTranscript = "";

        if (entry.is_encrypted && entry.title_encrypted && entry.content_encrypted) {
          if (encryptionReady) {
            try {
              const decrypted = await decryptJournalEntry(
                {
                  title_encrypted: entry.title_encrypted,
                  title_iv: entry.title_iv,
                  content_encrypted: entry.content_encrypted,
                  content_iv: entry.content_iv,
                  date: entry.date || "",
                  is_favorite: entry.is_favorite || false,
                  is_archived: entry.is_archived || false,
                  journal_type: entry.journal_type,
                  mood: entry.mood,
                  tags: entry.tags,
                  location: entry.location,
                  weather: entry.weather,
                },
                entry.user_id
              );

              title = decrypted.title || "";
              content = decrypted.content || "";
            } catch (decryptError) {
              console.warn(
                "[getAllJournalEntriesIncludingArchived] Decryption failed for entry:",
                entry.journal_id,
                decryptError
              );
              ({ title, content } = buildLockedContent());
            }
          } else {
            ({ title, content } = buildLockedContent());
          }
        }

        if (
          encryptionReady &&
          entry.voice_transcript_encrypted &&
          entry.voice_transcript_iv &&
          typeof entry.user_id === "string"
        ) {
          try {
            const key = await getEncryptionKey(entry.user_id);
            voiceTranscript = await decryptText(
              entry.voice_transcript_encrypted,
              entry.voice_transcript_iv,
              key
            );
          } catch (voiceDecryptError) {
            console.warn(
              "[getAllJournalEntriesIncludingArchived] Voice transcript decryption failed for entry:",
              entry.journal_id,
              voiceDecryptError
            );
            voiceTranscript = "";
          }
        }

        const mediaByType = {
          image: [] as any[],
          audio: [] as any[],
          video: [] as any[],
          document: [] as any[],
        };

        if (entry.journal_media && Array.isArray(entry.journal_media)) {
          entry.journal_media.forEach((media: any) => {
            const type = media.media_type as "image" | "audio" | "video" | "document";
            if (mediaByType[type]) {
              mediaByType[type].push(media);
            }
          });
        }

        const mediaTypes = Object.keys(mediaByType).filter(
          (key) => mediaByType[key as keyof typeof mediaByType].length > 0
        );

        const resolved = resolveJournalDisplayFields({
          title,
          date: entry.date || entry.created_at,
          hasVoiceMedia:
            mediaTypes.includes("audio") ||
            Boolean(entry.voice_transcript_encrypted) ||
            Boolean(entry.voice_transcript_source_signature) ||
            Boolean(entry.voice_transcript_generated_at),
          content,
          transcript: voiceTranscript,
        });

        return {
          journalId: entry.journal_id,
          title: resolved.title,
          content: resolved.content,
          resolvedContent: resolved.content,
          contentSource: resolved.contentSource,
          voiceTranscript,
          date: entry.date || "",
          displayDate: entry.display_date || entry.created_at,
          tags: entry.tags || [],
          mood: entry.mood || null,
          journalType: entry.journal_type || "",
          timestamp: entry.created_at,
          userId: entry.user_id,
          mediaType: mediaTypes,
          mediaUrl: {
            image: mediaByType.image.map((img: any) => img.public_url || img.thumbnail_url || ""),
            audio: mediaByType.audio.map((audio: any) => audio.public_url || ""),
            video: mediaByType.video.map((video: any) => video.public_url || video.thumbnail_url || ""),
            document: mediaByType.document.map((doc: any) => doc.public_url || ""),
          },
          fileName: entry.file_name || "",
          fileSize: entry.file_size || 0,
          createdAt: entry.created_at || "",
          updatedAt: entry.updated_at || "",
          isFavorite: entry.is_favorite || false,
          isArchived: entry.is_archived || false,
          wordCount: entry.word_count || 0,
          readingTimeMinutes: entry.reading_time_minutes || 0,
          isPublic: entry.is_public || false,
          publishedAt: entry.published_at || "",
          publishedShareId: entry.published_share_id || "",
        };
      })
    );

    return { entries: transformedEntries, encryptionStatus };
  } catch (error) {
    console.error("Error fetching journal entries (including archived):", error);
    return {
      entries: [],
      encryptionStatus: { ready: false, status: "error", reason: "fetch_failed" },
    };
  }
};

export const getAllJournalEntriesIncludingArchived = async (
  includeMedia: boolean = false,
  limit: number = 100
): Promise<JournalEntry[]> => {
  const result = await getAllJournalEntriesIncludingArchivedWithStatus(includeMedia, limit);
  return result.entries;
};

// Function to fetch a specific journal entry by ID
export const getJournalEntryById = async (id: string): Promise<JournalEntry | undefined> => {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${baseUrl}/api/journals/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json();
    const entry = data.journal;
    const mediaArray = data.media || [];

    const encryptionStatus = await ensureEncryptionReady({ userId: entry?.user_id });
    const encryptionReady = encryptionStatus.ready;

    let title = entry.title || "";
    let content = entry.content || "";
    let prompt: { text: string; explanation?: string } | null = null;

    if (entry.is_encrypted && entry.title_encrypted && entry.content_encrypted) {
      if (encryptionReady) {
        try {
          const decrypted = await decryptJournalEntry(
            {
              title_encrypted: entry.title_encrypted,
              title_iv: entry.title_iv,
              content_encrypted: entry.content_encrypted,
              content_iv: entry.content_iv,
              prompt_encrypted: entry.prompt_encrypted,
              prompt_iv: entry.prompt_iv,
              is_prompt_response: entry.is_prompt_response,
              date: entry.date || "",
              is_favorite: entry.is_favorite || false,
              is_archived: entry.is_archived || false,
              journal_type: entry.journal_type,
              mood: entry.mood,
              tags: entry.tags,
              location: entry.location,
              weather: entry.weather,
            },
            entry.user_id
          );

          title = decrypted.title || "";
          content = decrypted.content || "";
          prompt = decrypted.prompt || null;
        } catch (decryptError) {
          console.warn("[getJournalEntryById] Decryption failed for entry:", id, decryptError);
          ({ title, content } = buildLockedContent());
        }
      } else {
        ({ title, content } = buildLockedContent());
      }
    }

    if (!prompt && entry.prompt_encrypted && entry.prompt_iv && encryptionReady) {
      try {
        const key = await getEncryptionKey(entry.user_id);
        const rawPrompt = await decryptText(entry.prompt_encrypted, entry.prompt_iv, key);
        try {
          prompt = JSON.parse(rawPrompt);
        } catch {
          prompt = { text: rawPrompt };
        }
      } catch (err) {
        console.warn("[getJournalEntryById] Prompt decryption fallback failed:", err);
      }
    }

    const mediaByType = {
      image: [] as any[],
      audio: [] as any[],
      video: [] as any[],
      document: [] as any[],
    };

    mediaArray.forEach((media: any) => {
      const type = media.media_type as "image" | "audio" | "video" | "document";
      if (mediaByType[type]) {
        mediaByType[type].push(media);
      }
    });

    const mediaTypes = Object.keys(mediaByType).filter(
      (key) => mediaByType[key as keyof typeof mediaByType].length > 0
    );

    return {
      id: entry.id,
      journalId: entry.journal_id,
      title,
      content,
      date: entry.date || "",
      displayDate: entry.display_date || entry.created_at,
      tags: entry.tags || [],
      mood: entry.mood || null,
      journalType: entry.journal_type || "",
      timestamp: entry.created_at,
      userId: entry.user_id,
      mediaType: mediaTypes,
      mediaUrl: {
        image: mediaByType.image.map((img: any) => img.public_url || img.thumbnail_url || ""),
        audio: mediaByType.audio.map((audio: any) => audio.public_url || ""),
        video: mediaByType.video.map((video: any) => video.public_url || video.thumbnail_url || ""),
        document: mediaByType.document.map((doc: any) => doc.public_url || ""),
      },
      fileName: entry.file_name || "",
      fileSize: entry.file_size || 0,
      createdAt: entry.created_at || "",
      updatedAt: entry.updated_at || "",
      isFavorite: entry.is_favorite || false,
      isArchived: entry.is_archived || false,
      wordCount: entry.word_count || 0,
      readingTimeMinutes: entry.reading_time_minutes || 0,
      isPublic: entry.is_public || false,
      publishedAt: entry.published_at || "",
      publishedShareId: entry.published_share_id || "",
      prompt: prompt,
      prompt_encrypted: entry.prompt_encrypted || null,
      prompt_iv: entry.prompt_iv || null,
      is_prompt_response: entry.is_prompt_response ?? Boolean(prompt || entry.prompt_encrypted),
    };
  } catch (error) {
    console.error("Error fetching journal entry:", error);
    return undefined;
  }
};