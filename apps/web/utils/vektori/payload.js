export function buildVektoriJournalMessages(params) {
  const title = (params?.title || '').trim();
  const content = (params?.content || '').trim();
  const mood = (params?.mood || '').trim();
  const entryDate = (params?.entryDate || '').trim();
  const createdAt = (params?.createdAt || '').trim();
  const updatedAt = (params?.updatedAt || '').trim();
  const eventType = (params?.eventType || 'upsert').trim();
  const corrections = Array.isArray(params?.corrections) ? params.corrections : [];

  const lines = [
    `Journal ID: ${params?.journalId}`,
    `Event: ${eventType}`,
    title ? `Title: ${title}` : '',
    content ? `Content: ${content}` : '',
    mood ? `Mood: ${mood}` : '',
    entryDate ? `Entry Date: ${entryDate}` : '',
    createdAt ? `Created At: ${createdAt}` : '',
    updatedAt ? `Updated At: ${updatedAt}` : '',
    corrections.length > 0 ? `Corrections: ${corrections.join(' | ')}` : '',
  ].filter(Boolean);

  if (lines.length <= 2) return [];

  return [{ role: 'user', content: lines.join('\n') }];
}

export function buildVektoriOnboardingMessages(params) {
  const narrative = (params?.narrativeReflection || '').trim();
  const facts = Array.isArray(params?.explicitFacts) ? params.explicitFacts : [];
  const threads = Array.isArray(params?.unresolvedThreads) ? params.unresolvedThreads : [];
  const badges = Array.isArray(params?.sourceBadges) ? params.sourceBadges : [];
  const generatedAt = (params?.generatedAt || new Date().toISOString()).trim();

  const messages = [];

  if (narrative) {
    const reflectionLines = [
      'Category: Onboarding Day-1 Narrative Reflection',
      `Generated At: ${generatedAt}`,
      badges.length > 0 ? `Signal Sources: ${badges.join(', ')}` : '',
      `Reflection: ${narrative}`,
    ].filter(Boolean);
    messages.push({ role: 'user', content: reflectionLines.join('\n') });
  }

  if (facts.length > 0) {
    const factLines = [
      'Category: User Explicit Values & Core Facts',
      `Recorded At: ${generatedAt}`,
      'Explicit Facts:',
      ...facts.map((f) => `- [${f.category || 'general'}] ${f.fact}${f.source_label ? ` (${f.source_label})` : ''}`),
    ];
    messages.push({ role: 'user', content: factLines.join('\n') });
  }

  if (threads.length > 0) {
    const threadLines = [
      'Category: Initial Active Preoccupations & Threads',
      `Recorded At: ${generatedAt}`,
      'Active Threads:',
      ...threads.map((t) => `- [Topic: ${t.topic}] ${t.initial_context || ''}`),
    ];
    messages.push({ role: 'user', content: threadLines.join('\n') });
  }

  return messages;
}
