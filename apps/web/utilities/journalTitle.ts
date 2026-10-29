export const formatVoiceNoteTitle = (dateInput?: string | Date): string => {
  const parsedDate = typeof dateInput === 'string'
    ? new Date(dateInput)
    : (dateInput || new Date());
  const resolved = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  return `Voice Note ${resolved.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

interface ResolveJournalTitleOptions {
  title?: string | null;
  date?: string | Date;
  hasVoiceMedia?: boolean;
  defaultTitle?: string;
}

export const resolveJournalTitle = ({
  title,
  date,
  hasVoiceMedia = false,
  defaultTitle = 'Untitled Entry',
}: ResolveJournalTitleOptions): string => {
  const trimmed = (title || '').trim();
  if (trimmed) {
    return trimmed;
  }

  if (hasVoiceMedia) {
    return formatVoiceNoteTitle(date);
  }

  return defaultTitle;
};

type JournalContentSource = 'content' | 'transcript' | 'combined' | 'empty';

interface ResolveJournalContentOptions {
  content?: string | null;
  transcript?: string | null;
}

interface ResolvedJournalContent {
  value: string;
  source: JournalContentSource;
}

const normalizeEntryText = (value?: string | null): string => (value || '').trim();

export const resolveJournalContent = ({
  content,
  transcript,
}: ResolveJournalContentOptions): ResolvedJournalContent => {
  const normalizedContent = normalizeEntryText(content);
  const normalizedTranscript = normalizeEntryText(transcript);

  if (normalizedContent && normalizedTranscript) {
    return {
      value: `${normalizedContent}\n\nVoice Transcript:\n${normalizedTranscript}`,
      source: 'combined',
    };
  }

  if (normalizedContent) {
    return { value: normalizedContent, source: 'content' };
  }

  if (normalizedTranscript) {
    return { value: normalizedTranscript, source: 'transcript' };
  }

  return { value: '', source: 'empty' };
};

interface ResolveJournalDisplayOptions {
  title?: string | null;
  date?: string | Date;
  hasVoiceMedia?: boolean;
  defaultTitle?: string;
  content?: string | null;
  transcript?: string | null;
}

export const resolveJournalDisplayFields = ({
  title,
  date,
  hasVoiceMedia,
  defaultTitle = 'Untitled Entry',
  content,
  transcript,
}: ResolveJournalDisplayOptions) => {
  const resolvedContent = resolveJournalContent({ content, transcript });
  const resolvedTitle = resolveJournalTitle({
    title,
    date,
    hasVoiceMedia: hasVoiceMedia ?? resolvedContent.source !== 'empty',
    defaultTitle,
  });

  return {
    title: resolvedTitle,
    content: resolvedContent.value,
    contentSource: resolvedContent.source,
  };
};
