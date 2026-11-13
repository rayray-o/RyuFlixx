
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

export function generateSearchVariants(
  query: string,
  limit = 24,
): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const words = normalized.split(" ");
  const variants = new Map<string, number>();

  const add = (
    wordIndex: number,
    replacement: string,
    priority: number,
  ) => {
    const changed = [...words];
    changed[wordIndex] = replacement;
    const value = changed.join(" ");

    if (value === normalized) return;

    const previous = variants.get(value);
    if (previous === undefined || priority > previous) {
      variants.set(value, priority);
    }
  };

  words.forEach((word, wordIndex) => {
    if (word.length < 3) return;

    // Adjacent transpositions: "jailre" -> "jailer".
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === word[i + 1]) continue;

      add(
        wordIndex,
        word.slice(0, i) +
          word[i + 1] +
          word[i] +
          word.slice(i + 2),
        130,
      );
    }

    // Vowel substitutions: "avingers" -> "avengers".
    // These are deliberately generated before broad substitutions.
    const vowels = "aeiou";

    for (let i = 0; i < word.length; i++) {
      if (!vowels.includes(word[i])) continue;

      for (const vowel of vowels) {
        if (vowel === word[i]) continue;

        add(
          wordIndex,
          word.slice(0, i) + vowel + word.slice(i + 1),
          120,
        );
      }
    }

    // Missing letters.
    if (word.length >= 4) {
      for (let i = 0; i <= word.length; i++) {
        for (const letter of "etaoinshrdlucm") {
          add(
            wordIndex,
            word.slice(0, i) + letter + word.slice(i),
            95,
          );
        }
      }
    }

    // Accidental extra letters.
    if (word.length >= 4) {
      for (let i = 0; i < word.length; i++) {
        add(
          wordIndex,
          word.slice(0, i) + word.slice(i + 1),
          90,
        );
      }
    }

    // Other substitutions.
    for (let i = 0; i < word.length; i++) {
      for (const letter of "etaoinshrdlucm") {
        if (letter === word[i]) continue;

        add(
          wordIndex,
          word.slice(0, i) + letter + word.slice(i + 1),
          70,
        );
      }
    }
  });

  return [...variants.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, limit))
    .map(([value]) => value);
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

      // Damerau transposition: two neighboring letters swapped.
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        current[j] = Math.min(
          current[j],
          previous[j - 2] + 1,
        );
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
      best = Math.max(
        best,
        similarity(queryToken, candidateToken),
      );
    }

    return best;
  });

  const matched = scores.filter((score) => score >= 0.65).length;
  const average =
    scores.reduce((total, score) => total + score, 0) /
    scores.length;

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

function getTitleScore(
  item: SearchableItem,
  query: string,
): number {
  const titles = getTitles(item);
  let best = 0;

  for (const title of titles) {
    let score = 0;

    if (title === query) {
      score = 1;
    } else if (title.startsWith(query)) {
      score = 0.97;
    } else if (title.includes(query)) {
      score = 0.93;
    } else {
      score = Math.max(
        similarity(query, title),
        tokenSimilarity(query, title) * 0.96,
      );
    }

    best = Math.max(best, score);
  }

  return best;
}

function scoreItem<T extends SearchableItem>(
  item: T,
  normalizedQuery: string,
): RankedItem<T> {
  const titleScore = getTitleScore(item, normalizedQuery);
  const overview = normalizeSearchText(item.overview || "");

  const descriptionScore =
    overview && normalizedQuery.length >= 4
      ? Math.max(
          overview.includes(normalizedQuery) ? 0.48 : 0,
          tokenSimilarity(normalizedQuery, overview) * 0.42,
        )
      : 0;

  const score = Math.max(titleScore, descriptionScore);

  let match: RankedItem<T>["match"] = "description";

  if (titleScore === 1) {
    match = "exact";
  } else if (titleScore >= 0.9) {
    match = "title";
  } else if (titleScore >= descriptionScore) {
    match = "fuzzy";
  }

  return { item, score, match };
}

export function getSearchTitleMatchScore(
  item: SearchableItem,
  query: string,
): number {
  return getTitleScore(item, normalizeSearchText(query));
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
    .map(({ item, score, match }) => ({
      item,
      score,
      match,
    }));
}
