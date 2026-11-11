"use server";

import { tmdb } from "@/api/tmdb";
import { env } from "@/utils/env";
import { ActionResponse, ContentType } from "@/types";
import {
  generateSearchVariants,
  normalizeSearchText,
  rankSearchResults,
} from "@/utils/search";
import { parseSearchIntent } from "@/utils/search-intent";
import { Movie, Search, TV } from "tmdb-ts/dist/types";

export type SearchSuggestion = {
  id: number;
  title: string;
  type: "movie" | "tv";
  score: number;
};

type SearchItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

type SearchPage<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

type TmdbPerson = {
  id: number;
  name: string;
  known_for_department?: string;
};

type TmdbKeyword = {
  id: number;
  name: string;
};

type PersonCredit = SearchItem & {
  job?: string;
  department?: string;
};

type PersonCreditsResponse = {
  cast?: SearchItem[];
  crew?: PersonCredit[];
};

const TMDB_BASE = "https://api.themoviedb.org/3";
const PAGE_SIZE = 20;

async function tmdbRequest<T>(
  endpoint: string,
  params?: URLSearchParams,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${endpoint}`);

  if (params) {
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
      Accept: "application/json",
    },
    next: {
      revalidate: 300,
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function getItemTitle(item: SearchItem): string {
  return (
    item.title ??
    item.name ??
    item.original_title ??
    item.original_name ??
    ""
  );
}

function getItemDate(
  item: SearchItem,
  type: ContentType,
): string {
  return type === "movie"
    ? item.release_date ?? ""
    : item.first_air_date ?? "";
}

async function searchTitles(
  query: string,
  type: ContentType,
  page: number,
): Promise<SearchPage<SearchItem>> {
  const result =
    type === "movie"
      ? await tmdb.search.movies({ query, page })
      : await tmdb.search.tvShows({ query, page });

  return result as unknown as SearchPage<SearchItem>;
}

async function searchWithRecovery(
  query: string,
  type: ContentType,
  page: number,
): Promise<SearchPage<SearchItem>> {
  const original = await searchTitles(query, type, page);

  if (page !== 1 || original.results.length >= 5) {
    return original;
  }

  const variants = generateSearchVariants(query, 12).slice(0, 8);

  if (!variants.length) return original;

  const recoveredPages = await Promise.all(
    variants.map(async (variant) => {
      try {
        return await searchTitles(variant, type, 1);
      } catch {
        return null;
      }
    }),
  );

  const unique = new Map<number, SearchItem>();

  for (const item of original.results) {
    unique.set(item.id, item);
  }

  for (const recovered of recoveredPages) {
    for (const item of recovered?.results ?? []) {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    }
  }

  const ranked = rankSearchResults(
    [...unique.values()],
    query,
  ).map((result) => result.item);

  return {
    ...original,
    results: ranked,
    total_results: Math.max(
      original.total_results,
      ranked.length,
    ),
    total_pages: Math.max(
      original.total_pages,
      ranked.length ? 1 : 0,
    ),
  };
}

function personMatchScore(
  personName: string,
  query: string,
): number {
  const candidate = normalizeSearchText(personName);
  const wanted = normalizeSearchText(query);

  if (!candidate || !wanted) return 0;
  if (candidate === wanted) return 1;

  if (candidate.includes(wanted)) return 0.9;
  if (wanted.includes(candidate)) return 0.78;

  const wantedWords = wanted.split(" ").filter(Boolean);
  const candidateWords = candidate.split(" ").filter(Boolean);

  if (!wantedWords.length || !candidateWords.length) return 0;

  const matched = wantedWords.filter((word) =>
    candidateWords.some(
      (candidateWord) =>
        candidateWord === word ||
        candidateWord.startsWith(word) ||
        word.startsWith(candidateWord),
    ),
  ).length;

  return matched / wantedWords.length;
}

async function resolvePerson(
  query: string,
  role: "cast" | "director",
): Promise<TmdbPerson | null> {
  if (!query) return null;

  try {
    const params = new URLSearchParams({
      query,
      page: "1",
      include_adult: "false",
    });

    const result = await tmdbRequest<{
      results: TmdbPerson[];
    }>("/search/person", params);

    const ranked = (result.results ?? [])
      .map((person) => {
        let score = personMatchScore(person.name, query);

        const department =
          person.known_for_department?.toLowerCase() ?? "";

        if (
          role === "director" &&
          department.includes("direct")
        ) {
          score += 0.08;
        }

        if (
          role === "cast" &&
          department.includes("acting")
        ) {
          score += 0.08;
        }

        return { person, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];

    if (!best || best.score < 0.55) {
      return null;
    }

    return best.person;
  } catch (error) {
    console.error("Person lookup failed:", error);
    return null;
  }
}

const KEYWORD_EXPANSIONS: Record<string, string[]> = {
  "artificial intelligence": ["artificial intelligence", "robot"],
  "time travel": ["time travel", "time loop"],
  "parallel universe": ["parallel universe", "alternate reality"],
  "coming of age": ["coming of age", "adolescence"],
  "post apocalyptic": ["post apocalyptic", "dystopia"],
  psychological: ["psychological", "mind games"],
  loneliness: ["loneliness", "isolation"],
  lonely: ["loneliness"],
  alienation: ["alienation", "isolation"],
  fighting: ["struggle"],
  struggle: ["struggle", "resistance"],
  society: ["social issues"],
  survival: ["survival", "human nature"],
  dystopian: ["dystopia"],
  revenge: ["revenge"],
  heist: ["heist"],
  superhero: ["superhero"],
  zombie: ["zombie apocalypse"],
  vampire: ["vampire"],
  samurai: ["samurai"],
  "martial arts": ["martial arts"],
  "serial killer": ["serial killer"],
  detective: ["detective"],
  mafia: ["mafia"],
  gangster: ["gangster"],
  alien: ["extraterrestrial"],
  robot: ["robot"],
  underdog: ["underdog"],
};

function buildKeywordQueries(query: string): string[] {
  const normalized = normalizeSearchText(query);

  if (!normalized) return [];

  const queries = new Set<string>();
  queries.add(normalized);

  for (const [phrase, expansions] of Object.entries(
    KEYWORD_EXPANSIONS,
  )) {
    if (normalized.includes(phrase)) {
      for (const expansion of expansions) {
        queries.add(expansion);
      }
    }
  }

  const ignored = new Set([
    "a", "an", "the", "and", "or", "of", "to",
    "for", "in", "on", "at", "by", "with",
    "from", "against", "about", "someone",
    "something", "movies", "movie", "films",
    "film", "shows", "show", "series",
  ]);

  const words = normalized
    .split(" ")
    .filter((word) => word.length > 2 && !ignored.has(word));

  for (const word of words) {
    const expansions = KEYWORD_EXPANSIONS[word];

    if (expansions?.length) {
      queries.add(expansions[0]);
    }
  }

  if (queries.size < 4 && words.length >= 2) {
    queries.add(words.slice(-2).join(" "));
  }

  return [...queries].slice(0, 5);
}

function keywordMatchScore(
  keywordName: string,
  searchQuery: string,
): number {
  const name = normalizeSearchText(keywordName);
  const query = normalizeSearchText(searchQuery);

  if (!name || !query) return 0;
  if (name === query) return 1;

  if (name.includes(query) || query.includes(name)) {
    return 0.9;
  }

  const nameWords = name.split(" ").filter(Boolean);
  const queryWords = query.split(" ").filter(Boolean);

  const matched = nameWords.filter((word) =>
    queryWords.some(
      (queryWord) =>
        word === queryWord ||
        word.startsWith(queryWord) ||
        queryWord.startsWith(word),
    ),
  ).length;

  if (!nameWords.length) return 0;

  return matched / nameWords.length;
}

async function resolveKeywords(
  query: string,
): Promise<TmdbKeyword[]> {
  const searchQueries = buildKeywordQueries(query);

  if (!searchQueries.length) return [];

  const responses = await Promise.all(
    searchQueries.map(async (searchQuery) => {
      try {
        const params = new URLSearchParams({
          query: searchQuery,
          page: "1",
        });

        const response = await tmdbRequest<{
          results: TmdbKeyword[];
        }>("/search/keyword", params);

        return {
          searchQuery,
          results: response.results ?? [],
        };
      } catch {
        return {
          searchQuery,
          results: [],
        };
      }
    }),
  );

  const unique = new Map<
    number,
    { keyword: TmdbKeyword; score: number }
  >();

  for (const response of responses) {
    for (const keyword of response.results) {
      const score = keywordMatchScore(
        keyword.name,
        response.searchQuery,
      );

      if (score < 0.25) continue;

      const current = unique.get(keyword.id);

      if (!current || score > current.score) {
        unique.set(keyword.id, { keyword, score });
      }
    }
  }

  return [...unique.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.keyword);
}

function matchesIntentFilters(
  item: SearchItem,
  intent: ReturnType<typeof parseSearchIntent>,
  type: ContentType,
): boolean {
  if (intent.genres.length) {
    const itemGenres = item.genre_ids ?? [];

    const matchesAllGenres = intent.genres.every((genre) =>
      itemGenres.includes(genre),
    );

    if (!matchesAllGenres) return false;
  }

  const date = getItemDate(item, type);
  const year = Number(date.slice(0, 4));

  if (intent.yearFrom && (!year || year < intent.yearFrom)) {
    return false;
  }

  if (intent.yearTo && (!year || year > intent.yearTo)) {
    return false;
  }

  return true;
}

function semanticTextScore(
  item: SearchItem,
  query: string,
): number {
  const normalizedQuery = normalizeSearchText(query);

  const searchableText = normalizeSearchText(
    [
      getItemTitle(item),
      item.original_title ?? "",
      item.original_name ?? "",
      item.overview ?? "",
    ].join(" "),
  );

  const words = normalizedQuery
    .split(" ")
    .filter((word) => word.length > 2);

  if (!words.length || !searchableText) return 0;

  const matched = words.filter((word) =>
    searchableText.includes(word),
  ).length;

  const phraseMatch = searchableText.includes(normalizedQuery)
    ? 0.2
    : 0;

  return Math.min(
    1,
    matched / words.length + phraseMatch,
  );
}

function popularityScore(item: SearchItem): number {
  const popularity = Math.max(0, item.popularity ?? 0);
  const rating = Math.max(0, item.vote_average ?? 0);

  const popularityPart = Math.min(
    1,
    Math.log10(popularity + 1) / 4,
  );

  const ratingPart = Math.min(1, rating / 10);

  return popularityPart * 0.75 + ratingPart * 0.25;
}

function rankContextualItems(
  items: SearchItem[],
  keywordQuery?: string,
): SearchItem[] {
  return [...items].sort((a, b) => {
    const scoreA = keywordQuery
      ? semanticTextScore(a, keywordQuery) * 0.82 +
        popularityScore(a) * 0.18
      : popularityScore(a);

    const scoreB = keywordQuery
      ? semanticTextScore(b, keywordQuery) * 0.82 +
        popularityScore(b) * 0.18
      : popularityScore(b);

    return scoreB - scoreA;
  });
}

async function getPersonResults(
  intent: ReturnType<typeof parseSearchIntent>,
  type: ContentType,
  page: number,
): Promise<SearchPage<SearchItem> | null> {
  if (!intent.personQuery || !intent.personRole) {
    return null;
  }

  const person = await resolvePerson(
    intent.personQuery,
    intent.personRole,
  );

  if (!person) return null;

  const endpoint =
    type === "movie"
      ? `/person/${person.id}/movie_credits`
      : `/person/${person.id}/tv_credits`;

  const credits = await tmdbRequest<PersonCreditsResponse>(
    endpoint,
  );

  let selected: SearchItem[];

  if (intent.personRole === "director") {
    selected = (credits.crew ?? []).filter((credit) =>
      (credit.job ?? "").toLowerCase().includes("director"),
    );
  } else {
    selected = credits.cast ?? [];
  }

  const unique = new Map<number, SearchItem>();

  for (const item of selected) {
    if (item.id) unique.set(item.id, item);
  }

  let filtered = [...unique.values()].filter((item) =>
    matchesIntentFilters(item, intent, type),
  );

  if (intent.titleQuery) {
    filtered = filtered.filter((item) => {
      const score = rankSearchResults(
        [item],
        intent.titleQuery!,
      )[0]?.score ?? 0;

      return score >= 0.3;
    });
  }

  const ranked = rankContextualItems(
    filtered,
    intent.keywordQuery,
  );

  const totalResults = ranked.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);

  return {
    page,
    results: ranked.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE,
    ),
    total_results: totalResults,
    total_pages: totalPages,
  };
}

async function getDiscoverResults(
  intent: ReturnType<typeof parseSearchIntent>,
  type: ContentType,
  page: number,
): Promise<SearchPage<SearchItem> | null> {
  const keywords = intent.keywordQuery
    ? await resolveKeywords(intent.keywordQuery)
    : [];

  // If a descriptive query cannot be resolved to TMDB keywords
  // and has no other filters, let normal text search take over.
  if (
    intent.keywordQuery &&
    keywords.length === 0 &&
    intent.genres.length === 0 &&
    !intent.yearFrom &&
    !intent.yearTo
  ) {
    return null;
  }

  const params = new URLSearchParams({
    page: String(page),
    sort_by: intent.sortBy,
    include_adult: "false",
  });

  if (type === "tv") {
    params.set("include_null_first_air_dates", "false");
  }

  if (intent.genres.length) {
    // Commas mean every selected genre must match.
    params.set("with_genres", intent.genres.join(","));
  }

  const datePrefix =
    type === "movie"
      ? "primary_release_date"
      : "first_air_date";

  if (intent.yearFrom) {
    params.set(
      `${datePrefix}.gte`,
      `${intent.yearFrom}-01-01`,
    );
  }

  if (intent.yearTo) {
    params.set(
      `${datePrefix}.lte`,
      `${intent.yearTo}-12-31`,
    );
  }

  if (keywords.length) {
    // Pipes mean any of the selected related keywords may match.
    params.set(
      "with_keywords",
      keywords.map((keyword) => keyword.id).join("|"),
    );
  }

  if (intent.sortBy === "vote_average.desc") {
    params.set("vote_count.gte", "20");
  }

  const endpoint =
    type === "movie" ? "/discover/movie" : "/discover/tv";

  const response = await tmdbRequest<SearchPage<SearchItem>>(
    endpoint,
    params,
  );

  const results = intent.keywordQuery
    ? rankContextualItems(
        response.results ?? [],
        intent.keywordQuery,
      )
    : response.results ?? [];

  return {
    ...response,
    results,
  };
}

async function runSearch(
  query: string,
  type: ContentType,
  page: number,
): Promise<SearchPage<SearchItem>> {
  const intent = parseSearchIntent(query, type);

  // Normal title search. Keep typo recovery for actual titles.
  if (!intent.hasContext) {
    return searchWithRecovery(query.trim(), type, page);
  }

  // Person searches use actual cast or director credits.
  if (intent.personQuery) {
    const personResults = await getPersonResults(
      intent,
      type,
      page,
    );

    if (personResults) return personResults;

    // If TMDB cannot identify the person, do not silently
    // pretend the person filter worked.
    return searchWithRecovery(query.trim(), type, page);
  }

  // A title combined with filters, e.g. "Batman action movies".
  if (intent.titleQuery) {
    const titleResults = await searchWithRecovery(
      intent.titleQuery,
      type,
      1,
    );

    const filtered = titleResults.results.filter((item) =>
      matchesIntentFilters(item, intent, type),
    );

    const ranked = rankSearchResults(
      filtered,
      intent.titleQuery,
    ).map((result) => result.item);

    return {
      page: 1,
      results: ranked,
      total_results: ranked.length,
      total_pages: ranked.length ? 1 : 0,
    };
  }

  // Genre, year, ranking, and descriptive searches go
  // through TMDB discovery instead of literal title search.
  const contextualResults = await getDiscoverResults(
    intent,
    type,
    page,
  );

  if (contextualResults) return contextualResults;

  // Last-resort fallback for descriptions that TMDB's
  // keyword index cannot resolve.
  return searchWithRecovery(query.trim(), type, page);
}

export const getSearchResults = async (
  query: string,
  type: ContentType,
  page: number = 1,
): ActionResponse<(Search<Movie> | Search<TV>) | null> => {
  try {
    const normalizedQuery = normalizeSearchText(query);

    if (normalizedQuery.length < 2) {
      return {
        success: true,
        message: "Enter at least two characters",
        data: null,
      };
    }

    const result = await runSearch(query, type, page);

    return {
      success: true,
      message: "Search results fetched",
      data: result as Search<Movie> | Search<TV>,
    };
  } catch (error) {
    console.error("Search results error:", error);

    return {
      success: false,
      message: "Unable to fetch search results",
      data: null,
    };
  }
};

export const getSearchSuggestions = async (
  query: string,
  type: ContentType = "movie",
  limit: number = 10,
): ActionResponse<SearchSuggestion[] | null> => {
  try {
    const normalizedQuery = normalizeSearchText(query);

    if (normalizedQuery.length < 2) {
      return {
        success: true,
        message: "Enter at least two characters",
        data: [],
      };
    }

    const result = await runSearch(query, type, 1);

    const suggestions = result.results
      .map((item) => ({
        id: item.id,
        title: getItemTitle(item),
        type,
        score: 1,
      }))
      .filter((item) => item.id && item.title)
      .slice(0, Math.max(1, Math.min(limit, 20)));

    return {
      success: true,
      message: "Contextual suggestions fetched",
      data: suggestions,
    };
  } catch (error) {
    console.error("Search suggestions error:", error);

    return {
      success: false,
      message: "Error fetching search suggestions",
      data: null,
    };
  }
};
