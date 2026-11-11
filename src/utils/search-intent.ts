
export type SearchIntent = {
  year?: number;
  yearMode?: "before" | "after" | "exact";
  genres: number[];
  personQuery?: string;
  personRole?: "cast" | "crew";
  keywordQuery?: string;
  cleanedQuery: string;
};

const MOVIE_GENRES: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  "sci-fi": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

const TV_GENRES: Record<string, number> = {
  "action adventure": 10759,
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  "science fiction": 10765,
  "sci-fi": 10765,
  fantasy: 10765,
  soap: 10766,
  talk: 10767,
  "war and politics": 10768,
  western: 37,
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "for", "in",
  "on", "at", "by", "with", "from", "after", "before",
  "earlier", "later", "than", "since", "movies", "movie",
  "films", "film", "shows", "show", "series", "tv",
  "that", "is", "are", "about", "something", "like",
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseSearchIntent(
  query: string,
  type: "movie" | "tv"
): SearchIntent {
  let working = query.toLowerCase().trim();

  const genres: number[] = [];
  const genreMap = type === "movie" ? MOVIE_GENRES : TV_GENRES;

  const genreEntries = Object.entries(genreMap).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [genre, id] of genreEntries) {
    const expression = new RegExp(
      `\\b${escapeRegExp(genre)}\\b`,
      "i"
    );

    if (expression.test(working)) {
      if (!genres.includes(id)) genres.push(id);
      working = working.replace(expression, " ");
    }
  }

  let year: number | undefined;
  let yearMode: SearchIntent["yearMode"];

  const yearPatterns: {
    regex: RegExp;
    mode: SearchIntent["yearMode"];
  }[] = [
    {
      regex: /\b(?:before|earlier than|prior to)\s+(19\d{2}|20\d{2})\b/i,
      mode: "before",
    },
    {
      regex: /\b(?:after|later than|since)\s+(19\d{2}|20\d{2})\b/i,
      mode: "after",
    },
    {
      regex: /\b(?:in|from)\s+(19\d{2}|20\d{2})\b/i,
      mode: "exact",
    },
    {
      regex: /\b(19\d{2}|20\d{2})\b/,
      mode: "exact",
    },
  ];

  for (const pattern of yearPatterns) {
    const match = working.match(pattern.regex);

    if (match) {
      year = Number(match[1]);
      yearMode = pattern.mode;
      working = working.replace(match[0], " ");
      break;
    }
  }

  let personQuery: string | undefined;
  let personRole: SearchIntent["personRole"];

  const personPatterns = [
    {
      regex: /\b(?:directed by|director)\s+(.+)$/i,
      role: "crew" as const,
    },
    {
      regex: /\b(?:starring|featuring|with)\s+(.+)$/i,
      role: "cast" as const,
    },
  ];

  for (const pattern of personPatterns) {
    const match = working.match(pattern.regex);

    if (match?.[1]) {
      personQuery = match[1].trim();
      personRole = pattern.role;
      working = working.replace(match[0], " ");
      break;
    }
  }

  const cleanedQuery = working
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const keywordQuery = cleanedQuery
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(" ");

  return {
    year,
    yearMode,
    genres,
    personQuery,
    personRole,
    keywordQuery: keywordQuery || undefined,
    cleanedQuery,
  };
}
