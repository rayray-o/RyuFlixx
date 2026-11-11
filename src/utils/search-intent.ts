
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
  sci-fi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

const TV_GENRES: Record<string, number> = {
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
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "from",
  "about",
  "that",
  "is",
  "are",
  "was",
  "were",
  "movie",
  "movies",
  "film",
  "films",
  "show",
  "shows",
  "series",
  "tv",
  "anime",
  "something",
  "like",
  "similar",
  "before",
  "after",
  "during",
  "released",
  "made",
  "starring",
  "featuring",
  "directed",
  "by",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseSearchIntent(
  query: string,
  type: "movie" | "tv",
): SearchIntent {
  let working = query.toLowerCase();

  const genres = type === "movie" ? MOVIE_GENRES : TV_GENRES;
  const matchedGenres = new Set<number>();

  const genreNames = Object.keys(genres).sort(
    (a, b) => b.length - a.length,
  );

  for (const genreName of genreNames) {
    const expression = new RegExp(
      `\\b${escapeRegExp(genreName)}\\b`,
      "i",
    );

    if (expression.test(working)) {
      matchedGenres.add(genres[genreName]);
      working = working.replace(expression, " ");
    }
  }

  let year: number | undefined;
  let yearMode: SearchIntent["yearMode"];

  const yearMatch = working.match(
    /\b(before|earlier than|prior to|after|later than|since|in|from)\s+(19\d{2}|20\d{2})\b/i,
  );

  if (yearMatch) {
    year = Number(yearMatch[2]);

    const relation = yearMatch[1].toLowerCase();

    if (["before", "earlier than", "prior to"].includes(relation)) {
      yearMode = "before";
    } else if (["after", "later than", "since"].includes(relation)) {
      yearMode = "after";
    } else {
      yearMode = "exact";
    }

    working = working.replace(yearMatch[0], " ");
  } else {
    const standaloneYear = working.match(/\b(19\d{2}|20\d{2})\b/);

    if (standaloneYear) {
      year = Number(standaloneYear[1]);
      yearMode = "exact";
      working = working.replace(standaloneYear[0], " ");
    }
  }

  let personQuery: string | undefined;
  let personRole: SearchIntent["personRole"];

  const personMatch = working.match(
    /\b(directed by|director|starring|featuring|with)\s+([a-z][a-z .'-]{1,60})$/i,
  );

  if (personMatch) {
    const candidate = personMatch[2]
      .trim()
      .replace(/\b(in|from|released|made|during|before|after)\b.*$/i, "")
      .trim();

    if (candidate.length >= 3) {
      personQuery = candidate;
      personRole =
        personMatch[1].toLowerCase().includes("direct")
          ? "crew"
          : "cast";

      working = working.slice(0, personMatch.index).trim();
    }
  }

  const cleanedQuery = working
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const keywordQuery = cleanedQuery
    .split(/\s+/)
    .filter((word) => {
      return word.length > 2 && !STOP_WORDS.has(word);
    })
    .join(" ");

  return {
    year,
    yearMode,
    genres: [...matchedGenres],
    personQuery,
    personRole,
    keywordQuery: keywordQuery || undefined,
    cleanedQuery,
  };
}
