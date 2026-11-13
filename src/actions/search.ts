
"use server";

import { env } from "@/utils/env";
import { ActionResponse } from "@/types";
import {
  generateSearchVariants,
  getSearchTitleMatchScore,
  normalizeSearchText,
  rankSearchResults,
} from "@/utils/search";
import { parseSearchIntent } from "@/utils/search-intent";

const TMDB_BASE = "https://api.themoviedb.org/3";
const PAGE_SIZE = 20;

export type UnifiedSearchItem = {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
  runtime?: number | null;
  episode_run_time?: number[];
};

export type UnifiedSearchPage = {
  page: number;
  results: UnifiedSearchItem[];
  total_pages: number;
  total_results: number;
};

export type SearchSuggestion = {
  id: number;
  title: string;
  type: "movie" | "tv";
  poster_path: string | null;
  year: string;
  rating: number;
  runtime: number | null;
};

type TmdbResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
  runtime?: number | null;
  episode_run_time?: number[];
};

type TmdbPage = {
  page: number;
  results: TmdbResult[];
  total_pages: number;
  total_results: number;
};

type TmdbPerson = {
  id: number;
  name: string;
  known_for_department?: string;
};

type TmdbCredits = {
  cast?: TmdbResult[];
  crew?: (TmdbResult & {
    job?: string;
    department?: string;
  })[];
};

type SearchMode = "movie" | "tv";

async function tmdbRequest<T>(
  endpoint: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${endpoint}`);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function titleOf(item: TmdbResult): string {
  return (
    item.title ??
    item.name ??
    item.original_title ??
    item.original_name ??
    ""
  );
}

function toUnified(
  item: TmdbResult,
  type?: SearchMode,
): UnifiedSearchItem | null {
  const mediaType =
    type ??
    (item.media_type === "movie" || item.media_type === "tv"
      ? item.media_type
      : undefined);

  if (!mediaType || !item.id || !titleOf(item)) return null;

  return {
    id: item.id,
    media_type: mediaType,
    title: titleOf(item),
    original_title: item.original_title ?? item.original_name,
    overview: item.overview ?? "",
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average ?? 0,
    vote_count: item.vote_count ?? 0,
    popularity: item.popularity ?? 0,
    genre_ids: item.genre_ids ?? [],
    adult: item.adult ?? false,
    runtime: item.runtime ?? null,
    episode_run_time: item.episode_run_time ?? [],
  };
}

function getDate(item: UnifiedSearchItem): string {
  return item.media_type === "movie"
    ? item.release_date ?? ""
    : item.first_air_date ?? "";
}

function matchesIntent(
  item: UnifiedSearchItem,
  intent: ReturnType<typeof parseSearchIntent>,
): boolean {
  if (
    intent.genres.length &&
    !intent.genres.every((genre) =>
      (item.genre_ids ?? []).includes(genre),
    )
  ) {
    return false;
  }

  const date = getDate(item);
  const year = Number(date.slice(0, 4));

  if (intent.yearFrom && (!year || year < intent.yearFrom)) {
    return false;
  }

  if (intent.yearTo && (!year || year > intent.yearTo)) {
    return false;
  }

  return true;
}

function popularityScore(item: UnifiedSearchItem): number {
  const popularity = Math.max(0, item.popularity ?? 0);
  const rating = Math.max(0, item.vote_average ?? 0);

  return (
    Math.min(1, Math.log10(popularity + 1) / 4) * 0.75 +
    Math.min(1, rating / 10) * 0.25
  );
}

function rankUnified(
  items: UnifiedSearchItem[],
  query: string,
): UnifiedSearchItem[] {
  return rankSearchResults(items, query)
    .map(({ item, score, match }) => ({
      item,
      score:
        score * 0.9 +
        popularityScore(item) * 0.1 +
        (match === "exact" ? 0.08 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

async function searchMulti(
  query: string,
  page: number,
): Promise<TmdbPage> {
  return tmdbRequest<TmdbPage>("/search/multi", {
    query,
    page: String(page),
    include_adult: "false",
    language: "en-US",
  });
}

async function searchMultiWithRecovery(
  query: string,
  page: number,
): Promise<TmdbPage> {
  const original = await searchMulti(query, page);

  if (page !== 1) return original;

  const originalMedia = original.results.filter(
    (item) =>
      item.media_type === "movie" ||
      item.media_type === "tv",
  );

  const bestOriginalMatch = originalMedia.reduce(
    (best, item) =>
      Math.max(
        best,
        getSearchTitleMatchScore(
          {
            title: titleOf(item),
            original_title: item.original_title,
            original_name: item.original_name,
            overview: item.overview,
          },
          query,
        ),
      ),
    0,
  );

  // Don't waste recovery requests on an already strong title match.
  // A result count alone is not evidence of relevance.
  if (bestOriginalMatch >= 0.94) {
    return {
      ...original,
      results: rankSearchResults(originalMedia, query).map(
        ({ item }) => item,
      ),
    };
  }

  const variants = generateSearchVariants(query, 24);

  if (!variants.length) {
    return {
      ...original,
      results: rankSearchResults(originalMedia, query).map(
        ({ item }) => item,
      ),
    };
  }

  const recovered = await Promise.all(
    variants.map(async (variant) => {
      try {
        return await searchMulti(variant, 1);
      } catch {
        return null;
      }
    }),
  );

  const unique = new Map<string, TmdbResult>();

  for (const item of originalMedia) {
    unique.set(`${item.media_type}-${item.id}`, item);
  }

  for (const result of recovered) {
    for (const item of result?.results ?? []) {
      if (
        item.media_type !== "movie" &&
        item.media_type !== "tv"
      ) {
        continue;
      }

      const key = `${item.media_type}-${item.id}`;

      if (!unique.has(key)) {
        unique.set(key, item);
      }
    }
  }

  const merged = [...unique.values()];

  // Rank by the user's original spelling, not by the generated variant.
  const ranked = rankSearchResults(merged, query).map(
    ({ item }) => item,
  );

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

async function resolvePerson(
  name: string,
  role: "cast" | "director",
): Promise<TmdbPerson | null> {
  const response = await tmdbRequest<{
    results: TmdbPerson[];
  }>("/search/person", {
    query: name,
    page: "1",
    include_adult: "false",
  });

  const wanted = normalizeSearchText(name);

  const ranked = (response.results ?? [])
    .map((person) => {
      const candidate = normalizeSearchText(person.name);

      let score =
        candidate === wanted
          ? 1
          : candidate.includes(wanted) ||
              wanted.includes(candidate)
            ? 0.85
            : 0;

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

  return ranked[0]?.score >= 0.55
    ? ranked[0].person
    : null;
}

async function getPersonItems(
  query: string,
  role: "cast" | "director",
  type: SearchMode,
): Promise<UnifiedSearchItem[]> {
  const person = await resolvePerson(query, role);
  if (!person) return [];

  const endpoint =
    type === "movie"
      ? `/person/${person.id}/movie_credits`
      : `/person/${person.id}/tv_credits`;

  const credits = await tmdbRequest<TmdbCredits>(endpoint);

  const selected =
    role === "director"
      ? (credits.crew ?? []).filter((credit) =>
          (credit.job ?? "")
            .toLowerCase()
            .includes("director"),
        )
      : credits.cast ?? [];

  return selected
    .map((item) => toUnified(item, type))
    .filter(
      (item): item is UnifiedSearchItem => Boolean(item),
    );
}

async function getKeywordIds(
  query: string,
): Promise<number[]> {
  const phrases = new Set<string>([query]);

  const expansions: Record<string, string[]> = {
    "artificial intelligence": [
      "artificial intelligence",
      "robot",
    ],
    "time travel": ["time travel", "time loop"],
    lonely: ["loneliness", "isolation"],
    loneliness: ["loneliness", "isolation"],
    society: ["social issues", "society"],
    dystopian: ["dystopia"],
    psychological: ["psychological", "mind games"],
    revenge: ["revenge"],
    survival: ["survival"],
    samurai: ["samurai"],
    "serial killer": ["serial killer"],
    "martial arts": ["martial arts"],
  };

  Object.entries(expansions).forEach(([phrase, values]) => {
    if (query.includes(phrase)) {
      values.forEach((value) => phrases.add(value));
    }
  });

  const results = await Promise.all(
    [...phrases].slice(0, 5).map(async (phrase) => {
      try {
        const response = await tmdbRequest<{
          results: { id: number; name: string }[];
        }>("/search/keyword", {
          query: phrase,
          page: "1",
        });

        return (response.results ?? []).slice(0, 3);
      } catch {
        return [];
      }
    }),
  );

  const ids = new Set<number>();

  results.flat().forEach((keyword) => {
    if (keyword.id) ids.add(keyword.id);
  });

  return [...ids].slice(0, 5);
}

async function discoverByIntent(
  query: string,
  type: SearchMode,
  page: number,
): Promise<UnifiedSearchPage | null> {
  const intent = parseSearchIntent(query, type);

  if (!intent.hasContext) return null;

  if (intent.personQuery && intent.personRole) {
    const credits = await getPersonItems(
      intent.personQuery,
      intent.personRole,
      type,
    );

    const filtered = credits.filter((item) =>
      matchesIntent(item, intent),
    );

    const ranked = rankUnified(
      filtered,
      intent.keywordQuery ??
        intent.titleQuery ??
        query,
    );

    return {
      page,
      results: ranked.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE,
      ),
      total_results: ranked.length,
      total_pages: Math.ceil(ranked.length / PAGE_SIZE),
    };
  }

  if (intent.titleQuery) {
    const titleResults = await searchMultiWithRecovery(
      intent.titleQuery,
      1,
    );

    const items = titleResults.results
      .filter((item) => item.media_type === type)
      .map((item) => toUnified(item, type))
      .filter(
        (item): item is UnifiedSearchItem => Boolean(item),
      )
      .filter((item) => matchesIntent(item, intent));

    const ranked = rankUnified(items, intent.titleQuery);

    return {
      page,
      results: ranked.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE,
      ),
      total_results: ranked.length,
      total_pages: Math.ceil(ranked.length / PAGE_SIZE),
    };
  }

  const params: Record<string, string> = {
    page: String(page),
    sort_by: intent.sortBy,
    include_adult: "false",
    language: "en-US",
  };

  if (type === "tv") {
    params.include_null_first_air_dates = "false";
  }

  if (intent.genres.length) {
    params.with_genres = intent.genres.join(",");
  }

  const dateField =
    type === "movie"
      ? "primary_release_date"
      : "first_air_date";

  if (intent.yearFrom) {
    params[`${dateField}.gte`] =
      `${intent.yearFrom}-01-01`;
  }

  if (intent.yearTo) {
    params[`${dateField}.lte`] =
      `${intent.yearTo}-12-31`;
  }

  if (intent.keywordQuery) {
    const ids = await getKeywordIds(intent.keywordQuery);

    if (ids.length) {
      params.with_keywords = ids.join("|");
    } else if (
      !intent.genres.length &&
      !intent.yearFrom &&
      !intent.yearTo
    ) {
      return null;
    }
  }

  if (intent.sortBy === "vote_average.desc") {
    params["vote_count.gte"] = "20";
  }

  const endpoint =
    type === "movie"
      ? "/discover/movie"
      : "/discover/tv";

  const response = await tmdbRequest<TmdbPage>(
    endpoint,
    params,
  );

  const items = (response.results ?? [])
    .map((item) => toUnified(item, type))
    .filter(
      (item): item is UnifiedSearchItem => Boolean(item),
    );

  return {
    page: response.page,
    results: intent.keywordQuery
      ? rankUnified(items, intent.keywordQuery)
      : items,
    total_pages: response.total_pages,
    total_results: response.total_results,
  };
}

async function searchOneType(
  query: string,
  type: SearchMode,
  page: number,
): Promise<UnifiedSearchPage> {
  const contextual = await discoverByIntent(
    query,
    type,
    page,
  );

  if (contextual) return contextual;

  const response = await searchMultiWithRecovery(
    query,
    page,
  );

  const items = response.results
    .filter((item) => item.media_type === type)
    .map((item) => toUnified(item, type))
    .filter(
      (item): item is UnifiedSearchItem => Boolean(item),
    );

  return {
    page: response.page,
    results: items,
    total_pages: response.total_pages,
    total_results: items.length,
  };
}

async function getStandalonePersonResults(
  query: string,
): Promise<UnifiedSearchItem[] | null> {
  const normalized = normalizeSearchText(query);
  const words = normalized.split(" ").filter(Boolean);

  // Avoid treating ordinary one-word queries or long descriptions as names.
  if (words.length < 2 || words.length > 4) {
    return null;
  }

  const [castPerson, directorPerson] = await Promise.all([
    resolvePerson(query, "cast"),
    resolvePerson(query, "director"),
  ]);

  const exactCast =
    castPerson &&
    normalizeSearchText(castPerson.name) === normalized
      ? castPerson
      : null;

  const exactDirector =
    directorPerson &&
    normalizeSearchText(directorPerson.name) === normalized
      ? directorPerson
      : null;

  const person = exactCast ?? exactDirector;
  if (!person) return null;

  const role: "cast" | "director" =
    exactDirector &&
    person.id === exactDirector.id &&
    person.known_for_department?.toLowerCase().includes("direct")
      ? "director"
      : "cast";

  const [movies, shows] = await Promise.all([
    getPersonItems(query, role, "movie"),
    getPersonItems(query, role, "tv"),
  ]);

  const combined = [...movies, ...shows];

  const unique = new Map<string, UnifiedSearchItem>();

  for (const item of combined) {
    unique.set(
      `${item.media_type}-${item.id}`,
      item,
    );
  }

  return [...unique.values()].sort(
    (a, b) => popularityScore(b) - popularityScore(a),
  );
}

async function runUnifiedSearch(
  query: string,
  page: number,
): Promise<UnifiedSearchPage> {
  const intentMovie = parseSearchIntent(query, "movie");
  const intentTv = parseSearchIntent(query, "tv");

  if (
    intentMovie.personQuery &&
    intentMovie.personRole
  ) {
    const [movies, shows] = await Promise.all([
      searchOneType(query, "movie", page),
      searchOneType(query, "tv", page),
    ]);

    const combined = [
      ...movies.results,
      ...shows.results,
    ].sort(
      (a, b) => popularityScore(b) - popularityScore(a),
    );

    return {
      page,
      results: combined,
      total_pages: Math.max(
        movies.total_pages,
        shows.total_pages,
      ),
      total_results:
        movies.total_results + shows.total_results,
    };
  }

  if (
    !intentMovie.hasContext &&
    !intentTv.hasContext
  ) {
    // Standalone exact person-name search.
    if (page === 1) {
      const personResults =
        await getStandalonePersonResults(query);

      if (personResults?.length) {
        return {
          page: 1,
          results: personResults.slice(0, PAGE_SIZE),
          total_pages: Math.ceil(
            personResults.length / PAGE_SIZE,
          ),
          total_results: personResults.length,
        };
      }
    }

    const response = await searchMultiWithRecovery(
      query,
      page,
    );

    const results = response.results
      .map((item) => toUnified(item))
      .filter(
        (item): item is UnifiedSearchItem => Boolean(item),
      );

    return {
      page: response.page,
      results,
      total_pages: response.total_pages,
      total_results: response.total_results,
    };
  }

  const [movies, shows] = await Promise.all([
    searchOneType(query, "movie", page),
    searchOneType(query, "tv", page),
  ]);

  const combined = [
    ...movies.results,
    ...shows.results,
  ].sort(
    (a, b) => popularityScore(b) - popularityScore(a),
  );

  return {
    page,
    results: combined,
    total_pages: Math.max(
      movies.total_pages,
      shows.total_pages,
    ),
    total_results:
      movies.total_results + shows.total_results,
  };
}

async function enrichRuntime(
  item: UnifiedSearchItem,
): Promise<number | null> {
  try {
    const endpoint =
      item.media_type === "movie"
        ? `/movie/${item.id}`
        : `/tv/${item.id}`;

    const details = await tmdbRequest<{
      runtime?: number | null;
      episode_run_time?: number[];
    }>(endpoint);

    if (item.media_type === "movie") {
      return details.runtime ?? null;
    }

    return details.episode_run_time?.[0] ?? null;
  } catch {
    return null;
  }
}

export const getSearchResults = async (
  query: string,
  page = 1,
): ActionResponse<UnifiedSearchPage | null> => {
  try {
    if (normalizeSearchText(query).length < 2) {
      return {
        success: true,
        message: "Enter at least two characters",
        data: null,
      };
    }

    const result = await runUnifiedSearch(
      query.trim(),
      Math.max(1, page),
    );

    return {
      success: true,
      message: "Unified search results fetched",
      data: result,
    };
  } catch (error) {
    console.error("Unified search error:", error);

    return {
      success: false,
      message: "Unable to fetch search results",
      data: null,
    };
  }
};

export const getSearchSuggestions = async (
  query: string,
  limit = 8,
): ActionResponse<SearchSuggestion[] | null> => {
  try {
    if (normalizeSearchText(query).length < 2) {
      return {
        success: true,
        message: "Enter at least two characters",
        data: [],
      };
    }

    const result = await runUnifiedSearch(
      query.trim(),
      1,
    );

    const items = result.results.slice(
      0,
      Math.max(1, Math.min(limit, 12)),
    );

    const enriched = await Promise.all(
      items.map(async (item, index) => ({
        item,
        runtime:
          index < 6
            ? await enrichRuntime(item)
            : null,
      })),
    );

    const suggestions = enriched.map(
      ({ item, runtime }) => ({
        id: item.id,
        title: item.title,
        type: item.media_type,
        poster_path: item.poster_path,
        year: getDate(item).slice(0, 4),
        rating: item.vote_average ?? 0,
        runtime,
      }),
    );

    return {
      success: true,
      message: "Unified suggestions fetched",
      data: suggestions,
    };
  } catch (error) {
    console.error(
      "Unified search suggestions error:",
      error,
    );

    return {
      success: false,
      message: "Unable to fetch search suggestions",
      data: null,
    };
  }
};
