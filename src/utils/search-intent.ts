export type SearchIntent = {
  genres: number[];
  yearFrom?: number;
  yearTo?: number;
  personQuery?: string;
  personRole?: "cast" | "director";
  keywordQuery?: string;
  titleQuery?: string;
  sortBy: "popularity.desc" | "vote_average.desc";
  isDescriptive: boolean;
  hasContext: boolean;
};

type GenreMap = Record<string, number[]>;

const MOVIE_GENRES: GenreMap = {
  "action adventure": [28, 12],
  "romantic comedy": [10749, 35],
  "science fiction": [878],
  "sci fi": [878],
  "space": [878],
  action: [28],
  adventure: [12],
  animation: [16],
  comedy: [35],
  crime: [80],
  documentary: [99],
  drama: [18],
  family: [10751],
  fantasy: [14],
  history: [36],
  horror: [27],
  music: [10402],
  mystery: [9648],
  romance: [10749],
  thriller: [53],
  war: [10752],
  western: [37],
};

const TV_GENRES: GenreMap = {
  "action adventure": [10759],
  "science fiction": [10765],
  "sci fi": [10765],
  action: [10759],
  adventure: [10759],
  animation: [16],
  comedy: [35],
  crime: [80],
  documentary: [99],
  drama: [18],
  family: [10751],
  kids: [10762],
  mystery: [9648],
  news: [10763],
  reality: [10764],
  fantasy: [10765],
  soap: [10766],
  talk: [10767],
  "war and politics": [10768],
  western: [37],
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "for",
  "in", "on", "at", "by", "with", "from", "after",
  "before", "earlier", "later", "than", "since",
  "until", "prior", "between", "during", "released",
  "movie", "movies", "film", "films", "show", "shows",
  "series", "tv", "something", "someone", "that",
  "is", "are", "about", "based", "around", "centered",
  "best", "top", "rated", "highest", "greatest",
  "popular", "most", "acclaimed", "underrated",
]);

const THEME_PHRASES = [
  "artificial intelligence",
  "time travel",
  "parallel universe",
  "post apocalyptic",
  "coming of age",
  "mind bending",
  "psychological",
  "loneliness",
  "lonely",
  "alienation",
  "survival",
  "dystopian",
  "serial killer",
  "detective",
  "superhero",
  "martial arts",
  "revenge",
  "heist",
  "zombie",
  "vampire",
  "samurai",
  "mafia",
  "gangster",
  "robot",
  "alien",
  "underdog",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanPersonName(value: string): string {
  return value
    .replace(/^\s*(actor|actress|director|star)\s+/i, "")
    .replace(/\s+(movies?|films?|shows?|series|filmography)$/i, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeYear(
  working: string,
): {
  working: string;
  yearFrom?: number;
  yearTo?: number;
} {
  let yearFrom: number | undefined;
  let yearTo: number | undefined;

  const range = working.match(
    /\bbetween\s+(19\d{2}|20\d{2})\s+(?:and|to)\s+(19\d{2}|20\d{2})\b/i,
  );

  if (range) {
    yearFrom = Number(range[1]);
    yearTo = Number(range[2]);

    working = working.replace(range[0], " ");
    return { working, yearFrom, yearTo };
  }

  const before = working.match(
    /\b(?:before|earlier than|prior to|up to|until)\s+(19\d{2}|20\d{2})\b/i,
  );

  if (before) {
    yearTo = Number(before[1]) - 1;
    working = working.replace(before[0], " ");
    return { working, yearFrom, yearTo };
  }

  const after = working.match(
    /\b(?:after|later than|since)\s+(19\d{2}|20\d{2})\b/i,
  );

  if (after) {
    yearFrom = Number(after[1]) + 1;
    working = working.replace(after[0], " ");
    return { working, yearFrom, yearTo };
  }

  const decade = working.match(/\b(19|20)(\d)0s\b/i);

  if (decade) {
    yearFrom = Number(`${decade[1]}${decade[2]}0`);
    yearTo = yearFrom + 9;
    working = working.replace(decade[0], " ");
    return { working, yearFrom, yearTo };
  }

  const exact = working.match(
    /\b(?:(?:released|made)\s+)?(?:in|from|year)\s+(19\d{2}|20\d{2})\b/i,
  );

  if (exact) {
    yearFrom = Number(exact[1]);
    yearTo = yearFrom;
    working = working.replace(exact[0], " ");
    return { working, yearFrom, yearTo };
  }

  const standalone = working.match(/\b(19\d{2}|20\d{2})\b/);

  if (standalone) {
    yearFrom = Number(standalone[1]);
    yearTo = yearFrom;
    working = working.replace(standalone[0], " ");
  }

  return { working, yearFrom, yearTo };
}

function removePerson(
  working: string,
): {
  working: string;
  personQuery?: string;
  personRole?: "cast" | "director";
} {
  const directorMatch = working.match(
    /\b(?:directed by|director(?: of)?|filmmaker)\s+(.+)$/i,
  );

  if (directorMatch?.[1]) {
    const personQuery = cleanPersonName(directorMatch[1]);

    if (personQuery) {
      return {
        working: working.replace(directorMatch[0], " "),
        personQuery,
        personRole: "director",
      };
    }
  }

  const explicitCastMatch = working.match(
    /\b(?:starring|featuring|acted by|cast with)\s+(.+)$/i,
  );

  if (explicitCastMatch?.[1]) {
    const personQuery = cleanPersonName(explicitCastMatch[1]);

    if (personQuery) {
      return {
        working: working.replace(explicitCastMatch[0], " "),
        personQuery,
        personRole: "cast",
      };
    }
  }

  const withMatch = working.match(/\bwith\s+(.+)$/i);

  if (withMatch?.[1]) {
    const personQuery = cleanPersonName(withMatch[1]);
    const words = personQuery.split(/\s+/).filter(Boolean);

    // Avoid treating descriptions such as "with a robot"
    // as an actor name.
    if (
      words.length >= 2 &&
      !/^(a|an|the)\s/i.test(personQuery)
    ) {
      return {
        working: working.replace(withMatch[0], " "),
        personQuery,
        personRole: "cast",
      };
    }
  }

  const byMatch = working.match(
    /^(?:movies?|films?|shows?|series)\s+by\s+(.+)$/i,
  );

  if (byMatch?.[1]) {
    const personQuery = cleanPersonName(byMatch[1]);

    if (personQuery) {
      return {
        working: "",
        personQuery,
        personRole: "director",
      };
    }
  }

  return { working };
}

export function parseSearchIntent(
  query: string,
  type: "movie" | "tv",
): SearchIntent {
  const original = query
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let working = original;

  let sortBy: SearchIntent["sortBy"] = "popularity.desc";

  if (
    /\b(best|top rated|highest rated|greatest|critically acclaimed|underrated)\b/i.test(
      working,
    )
  ) {
    sortBy = "vote_average.desc";
  }

  working = working.replace(
    /\b(best|top rated|highest rated|greatest|critically acclaimed|underrated|popular|most popular)\b/gi,
    " ",
  );

  const date = removeYear(working);
  working = date.working;

  const genreMap = type === "movie" ? MOVIE_GENRES : TV_GENRES;
  const genres: number[] = [];

  const genreEntries = Object.entries(genreMap).sort(
    ([a], [b]) => b.length - a.length,
  );

  for (const [genre, ids] of genreEntries) {
    const expression = new RegExp(
      `\\b${escapeRegExp(genre)}\\b`,
      "i",
    );

    if (expression.test(working)) {
      for (const id of ids) {
        if (!genres.includes(id)) genres.push(id);
      }

      working = working.replace(expression, " ");
    }
  }

  const person = removePerson(working);
  working = person.working;

  const cleanedQuery = working
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(" ")
    .trim();

  const originalWords = original.split(/\s+/).filter(Boolean);
  const cleanedWords = cleanedQuery.split(/\s+/).filter(Boolean);

  const explicitDescription =
    /\b(about|similar to|like|where|whose|based on|story of|story about|someone|something)\b/i.test(
      original,
    );

  const hasThemePhrase = THEME_PHRASES.some((phrase) =>
    original.includes(phrase),
  );

  const hasGenre = genres.length > 0;

  const isDescriptive =
    !person.personQuery &&
    (
      explicitDescription ||
      originalWords.length >= 6 ||
      (hasGenre && cleanedWords.length > 0 && hasThemePhrase) ||
      (hasThemePhrase && originalWords.length >= 3)
    );

  const hasDate = Boolean(date.yearFrom || date.yearTo);
  const hasPerson = Boolean(person.personQuery);

  const hasContext =
    hasGenre ||
    hasDate ||
    hasPerson ||
    isDescriptive ||
    sortBy !== "popularity.desc";

  const keywordQuery =
    isDescriptive && cleanedQuery
      ? cleanedQuery
      : undefined;

  const titleQuery =
    hasContext && cleanedQuery && !isDescriptive
      ? cleanedQuery
      : undefined;

  return {
    genres,
    yearFrom: date.yearFrom,
    yearTo: date.yearTo,
    personQuery: person.personQuery,
    personRole: person.personRole,
    keywordQuery,
    titleQuery,
    sortBy,
    isDescriptive,
    hasContext,
  };
    }
