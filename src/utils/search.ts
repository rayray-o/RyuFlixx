
type SearchableItem = {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
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
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Avoid expensive comparisons for obviously unrelated strings.
  if (Math.abs(a.length - b.length) > 4) {
    return Math.max(a.length, b.length);
  }

  let previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index,
  );

  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );

      // Adjacent transposition support.
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

    previous = [...current];
  }

  return previous[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const distance = levenshtein(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

function tokenSimilarity(query: string, candidate: string): number {
  const queryTokens = query.split(" ").filter(Boolean);
  const candidateTokens = candidate.split(" ").filter(Boolean);

  if (!queryTokens.length || !candidateTokens.length) return 0;

  const scores = queryTokens.map((queryToken) => {
    let best = 0;

    for (const candidateToken of candidateTokens) {
      const score = similarity(queryToken, candidateToken);

      if (score > best) best = score;
      if (best === 1) break;
    }

    return best;
  });

  const matched = scores.filter((score) => score >= 0.68).length;
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
      const directSimilarity = similarity(normalizedQuery, title);
      const tokenScore = tokenSimilarity(normalizedQuery, title);

      score = Math.max(
        directSimilarity * 0.88,
        tokenScore * 0.9,
      );

      type = "fuzzy";
    }

    if (score > bestScore) {
      bestScore = score;
      match = type;
    }
  }

  // Description matches are useful, but should not outrank
  // strong title matches.
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

  return {
    item,
    score: bestScore,
    match,
  };
}

export function rankSearchResults<T extends SearchableItem>(
  items: T[],
  query: string,
): RankedItem<T>[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return items.map((item) => ({
      item,
      score: 0,
      match: "description",
    }));
  }

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
