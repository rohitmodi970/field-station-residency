const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'can', 'will', 'just', 'don', 'should', 'now', 'what', 'are', 'my', 'is',
  'how', 'where', 'why', 'who', 'did', 'have', 'has', 'had', 'been', 'being', 'was', 'were',
  'write', 'wrote', 'tell', 'me', 'give', 'show', 'find', 'get', 'do', 'does', 'i', 'you',
  'we', 'they', 'he', 'she', 'it', 'this', 'that', 'these', 'those', 'am', 'be', 'would',
  'could', 'may', 'might', 'must', 'shall', 'whar', 'waht', 'wht',
]);

const TYPO_MAP = {
  whar: 'what',
  waht: 'what',
  wht: 'what',
};

/** Related words that should match each other in journal search. */
const SYNONYM_GROUPS = [
  ['allergy', 'allergies', 'allergic'],
  ['med', 'meds', 'medication', 'medications', 'medicine', 'medicines'],
  ['timing', 'timings', 'schedule', 'scheduled'],
  ['goal', 'goals', 'habit', 'habits', 'resolution', 'resolutions'],
  ['thyroid'],
  ['dose', 'doses', 'dosage'],
  ['symptom', 'symptoms'],
  ['mood', 'feeling', 'feelings', 'emotion', 'emotions'],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stemWord(word) {
  const w = String(word || '').toLowerCase().trim();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

function expandSingleTerm(term) {
  const normalized = String(term || '').toLowerCase().trim();
  if (!normalized) return [];

  const expanded = new Set([normalized, stemWord(normalized)]);

  for (const group of SYNONYM_GROUPS) {
    const stems = group.map(stemWord);
    if (group.includes(normalized) || stems.includes(stemWord(normalized))) {
      for (const item of group) {
        expanded.add(item);
        expanded.add(stemWord(item));
      }
    }
  }

  return [...expanded].filter(Boolean);
}

export function extractSearchTerms(query) {
  const raw = String(query || '').trim().toLowerCase();
  if (!raw) return '';

  const words = raw
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((word) => TYPO_MAP[word] || word)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));

  if (words.length === 0) {
    return raw.replace(/[^\w\s]/g, ' ').trim();
  }

  return words.join(' ');
}

export function expandSearchTerms(query) {
  const baseTerms = extractSearchTerms(query).split(/\s+/).filter(Boolean);
  const expanded = new Set();

  for (const term of baseTerms) {
    for (const variant of expandSingleTerm(term)) {
      expanded.add(variant);
    }
  }

  return [...expanded];
}

export function buildSearchPlan(query) {
  const primary = extractSearchTerms(query) || String(query || '').trim().toLowerCase();
  const baseTerms = primary.split(/\s+/).filter(Boolean);
  const expandedTerms = expandSearchTerms(query);
  const searchQueries = [primary];

  if (expandedTerms.length > 0) {
    searchQueries.push(expandedTerms.join(' '));
    for (const term of baseTerms) {
      const variants = expandSingleTerm(term);
      if (variants.length > 0) {
        searchQueries.push(variants.join(' '));
      }
    }
  }

  return {
    primary,
    baseTerms,
    expandedTerms,
    searchQueries: [...new Set(searchQueries.filter(Boolean))],
  };
}

export function termMatchesText(text, term) {
  const haystack = String(text || '').toLowerCase();
  if (!haystack.trim()) return false;

  for (const variant of expandSingleTerm(term)) {
    if (variant.length <= 3) {
      if (variant === 'med') {
        if (/\bmed(?:s|ication|icine|ications|icines)?\b/i.test(haystack)) return true;
      }
      const shortPattern = new RegExp(`\\b${escapeRegExp(variant)}\\w*\\b`, 'i');
      if (shortPattern.test(haystack)) return true;
      continue;
    }

    if (haystack.includes(variant)) return true;

    const stem = stemWord(variant);
    if (stem !== variant) {
      const stemPattern = new RegExp(`\\b${escapeRegExp(stem)}\\w*\\b`, 'i');
      if (stemPattern.test(haystack)) return true;
    }
  }

  return false;
}

export function scoreTextMatch(text, terms) {
  const haystack = String(text || '');
  if (!haystack.trim() || terms.length === 0) return 0;

  let score = 0;
  let matchedGroups = 0;

  for (const term of terms) {
    if (termMatchesText(haystack, term)) {
      matchedGroups += 1;
      score += 1;
    }
  }

  if (matchedGroups === terms.length && terms.length > 1) {
    score += 2;
  }

  return score;
}

export function scoreVektoriResult(result, baseTerms) {
  if (!result || baseTerms.length === 0) return 0;

  const items = [...(result.facts || []), ...(result.episodes || []), ...(result.sentences || [])];
  let best = 0;

  for (const item of items) {
    best = Math.max(best, scoreTextMatch(String(item?.text || ''), baseTerms));
  }

  return best;
}
