/**
 * Citation Key Generator
 * 
 * Generates citation keys in the format: LastNameYearFirstWord
 * Handles deduplication with suffix (a, b, c, ...)
 * 
 * No framework dependencies.
 */

/**
 * Input for citation key generation
 */
export interface CitationKeyInput {
  authors: Array<{ lastName: string }>;
  year?: string;
  title?: string;
}

/**
 * Generate a citation key from bibliography metadata
 * 
 * Format: LastNameYearFirstWord
 * - Uses first author's last name (or "Unknown" if no authors)
 * - Uses year (or "NoDate" if missing)
 * - Uses first meaningful word from title (or "Untitled" if missing)
 * - Removes non-alphanumeric characters
 * - Limits to 64 characters
 * 
 * @param input - Citation metadata
 * @returns Generated citation key
 */
export function generateCitationKey(input: CitationKeyInput): string {
  // Extract last name
  const lastName = input.authors.length > 0
    ? sanitize(input.authors[0].lastName)
    : "Unknown";

  // Extract year
  const year = input.year ? sanitize(input.year) : "NoDate";

  // Extract first meaningful word from title
  const firstWord = extractFirstWord(input.title);

  // Combine and limit length
  const key = `${lastName}${year}${firstWord}`;
  return key.slice(0, 64);
}

/**
 * Deduplicate citation key by appending suffix (a, b, c, ...)
 * 
 * @param candidate - Candidate citation key
 * @param existingKeys - Set of existing keys
 * @returns Unique citation key
 */
export function dedupeKey(candidate: string, existingKeys: Set<string>): string {
  if (!existingKeys.has(candidate)) {
    return candidate;
  }

  // Try suffixes a, b, c, ..., z, aa, ab, ...
  const suffixes = generateSuffixes();
  
  for (const suffix of suffixes) {
    const withSuffix = candidate + suffix;
    if (!existingKeys.has(withSuffix)) {
      return withSuffix;
    }
  }

  // Fallback: append timestamp if all suffixes exhausted
  return `${candidate}${Date.now()}`;
}

/**
 * Remove non-alphanumeric characters and normalize
 */
function sanitize(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * Extract first meaningful word from title
 * Skips common articles (a, an, the)
 */
function extractFirstWord(title?: string): string {
  if (!title) {
    return "Untitled";
  }

  // Split into words and filter
  const words = title
    .toLowerCase()
    .split(/\s+/)
    .map(w => sanitize(w))
    .filter(w => w.length > 0);

  // Skip articles
  const articles = new Set(["a", "an", "the"]);
  
  for (const word of words) {
    if (!articles.has(word)) {
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
  }

  // If only articles, use first word
  if (words.length > 0) {
    const word = words[0];
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  return "Untitled";
}

/**
 * Generate suffix sequence: a, b, c, ..., z, aa, ab, ...
 */
function* generateSuffixes(): Generator<string> {
  // Single letters: a-z
  for (let i = 0; i < 26; i++) {
    yield String.fromCharCode(97 + i);
  }

  // Double letters: aa-zz
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      yield String.fromCharCode(97 + i) + String.fromCharCode(97 + j);
    }
  }
}
