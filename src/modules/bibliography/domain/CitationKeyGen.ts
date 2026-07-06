
export interface CitationKeyInput {
  authors: Array<{ lastName: string }>;
  year?: string;
  title?: string;
}

export function generateCitationKey(input: CitationKeyInput): string {
  const lastName = input.authors.length > 0
    ? sanitize(input.authors[0].lastName)
    : "Unknown";

  const year = input.year ? sanitize(input.year) : "NoDate";

  const firstWord = extractFirstWord(input.title);

  const key = `${lastName}${year}${firstWord}`;
  return key.slice(0, 64);
}

export function dedupeKey(candidate: string, existingKeys: Set<string>): string {
  if (!existingKeys.has(candidate)) {
    return candidate;
  }

  const suffixes = generateSuffixes();
  
  for (const suffix of suffixes) {
    const withSuffix = candidate + suffix;
    if (!existingKeys.has(withSuffix)) {
      return withSuffix;
    }
  }

  return `${candidate}${Date.now()}`;
}

function sanitize(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, "");
}

function extractFirstWord(title?: string): string {
  if (!title) {
    return "Untitled";
  }

  const words = title
    .toLowerCase()
    .split(/\s+/)
    .map(w => sanitize(w))
    .filter(w => w.length > 0);

  const articles = new Set(["a", "an", "the"]);
  
  for (const word of words) {
    if (!articles.has(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
  }

  if (words.length > 0) {
    const word = words[0];
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  return "Untitled";
}

function* generateSuffixes(): Generator<string> {
  for (let i = 0; i < 26; i++) {
    yield String.fromCharCode(97 + i);
  }

  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      yield String.fromCharCode(97 + i) + String.fromCharCode(97 + j);
    }
  }
}
