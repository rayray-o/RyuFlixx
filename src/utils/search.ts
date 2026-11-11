
type SearchableItem = {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
};

export type RankedItem<T> = {
  item: T;
  score: number;
  match: "exact" | "title" | "fuzzy" | "description";
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates a limited number of plausible spelling corrections.
 * These are retrieval queries, not just ranking comparisons.
 */
export function generateSearchVariants(query: string, limit = 8): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const words = normalized.split(" ");
  const variants = new Set<string>();

  const addVariant = (wordIndex: number, replacement: string) => {
    const changed = [...words];
    changed[wordIndex] = replacement;
    const candidate = changed.join(" ");

    if (candidate !== normalized) variants.add(candidate);
  };

  // Common vowel substitutions. "Avingers" -> "Avengers".
  const vowelOrder = ["e", "a", "o", "u", "i"];

  words.forEach((word, wordIndex) => {
    if (word.length < 3) return;

    for (let i = 0; i < word.length; i++) {
      const character = word[i];

      if ("aeiou".includes(character)) {
        for (const vowel of vowelOrder) {
          if (vowel === character) continue;

          addVariant(
            wordIndex,
            word.slice(0, i) + vowel + word.slice(i + 1),
          );
        }
      }
    }
  });

  // Adjacent letters accidentally typed in the wrong order.
  words.forEach((word, wordIndex) => {
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === word[i + 1]) continue;

      addVariant(
        wordIndex,
        word.slice(0, i) +
          word[i + 1] +
          word[i] +
          word.slice(i + 2),
      );
    }
  });

  // A missing letter, often caused by fast typing.
  words.forEach((word, wordIndex) => {
    if (word.length < 4) return;

    for (let i = 1; i < word.length; i++) {
      for (const vowel of ["e", "a", "i", "o", "u"]) {
        addVariant(
          wordIndex,
          word.slice(0, i) + vowel + word.slice(i),
        );
      }
    }
  });

  return [...variants].slice(0, Math.max(0, limit));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index,
  );

  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1);
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        current[j] = Math.min(current[j], previous[j - 2] + 1);
      }
    }

    previous = current;
  }

  return previous[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  return Math.max(
    0,
    1 - levenshtein(a, b) / Math.max(a.length, b.length),
  );
}

function tokenSimilarity(query: string, candidate: string): number {
  const queryTokens = query.split(" ").filter(Boolean);
  const candidateTokens = candidate.split(" ").filter(Boolean);

  if (!queryTokens.length || !candidateTokens.length) return 0;

  const scores = queryTokens.map((queryToken) => {
    let best = 0;

    for (const candidateToken of candidateTokens) {
      best = Math.max(best, similarity(queryToken, candidateToken));
    }

    return best;
  });

  const matched = scores.filter((score) => score >= 0.65).length;
  const average =
    scores.reduce((total, score) => total + score, 0) / scores.length;

  return average * (matched / queryTokens.length);
}

function getTitles(item: SearchableItem): string[] {
  return [
    item.title,
    item.name,
    item.original_title,
    item.original_name,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeSearchText)
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function scoreItem<T extends SearchableItem>(
  item: T,
  normalizedQuery: string,
): RankedItem<T> {
  const titles = getTitles(item);
  const overview = normalizeSearchText(item.overview || "");

  let bestScore = 0;
  let match: RankedItem<T>["match"] = "description";

  for (const title of titles) {
    let score = 0;
    let type: RankedItem<T>["match"] = "fuzzy";

    if (title === normalizedQuery) {
      score = 1;
      type = "exact";
    } else if (title.startsWith(normalizedQuery)) {
      score = 0.96;
      type = "title";
    } else if (title.includes(normalizedQuery)) {
      score = 0.91;
      type = "title";
    } else {
      score = Math.max(
        similarity(normalizedQuery, title) * 0.88,
        tokenSimilarity(normalizedQuery, title) * 0.9,
      );
    }

    if (score > bestScore) {
      bestScore = score;
      match = type;
    }
  }

  if (overview && normalizedQuery.length >= 4) {
    const descriptionScore = Math.max(
      overview.includes(normalizedQuery) ? 0.66 : 0,
      tokenSimilarity(normalizedQuery, overview) * 0.62,
    );

    if (descriptionScore > bestScore) {
      bestScore = descriptionScore;
      match = "description";
    }
  }

  return { item, score: bestScore, match };
}

export function rankSearchResults<T extends SearchableItem>(
  items: T[],
  query: string,
): RankedItem<T>[] {
  const normalizedQuery = normalizeSearchText(query);

  return items
    .map((item, index) => ({
      ...scoreItem(item, normalizedQuery),
      originalIndex: index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ item, score, match }) => ({ item, score, match }));
}
