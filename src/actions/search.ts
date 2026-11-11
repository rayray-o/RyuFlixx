
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

type SearchFunction<T extends SearchItem> = (
  query: string,
  page: number,
) => Promise<Search<T>>;

const TMDB_BASE = "https://api.themoviedb.org/3";

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
    throw new Error(
      `TMDB request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

async function searchWithRecovery<T extends SearchItem>(
  query: string,
  page: number,
  searchFunction: SearchFunction<T>,
): Promise<Search<T>> {
  const original = await searchFunction(query, page);

  if (page !== 1 || original.results.length >= 5) {
    return original;
  }

  const variants = generateSearchVariants(query, 8);

  if (!variants.length) return original;

  const recoveredPages = await Promise.all(
    variants.map(async (variant) => {
      try {
        return await searchFunction(variant, 1);
      } catch {
        return null;
      }
    }),
  );

  const unique = new Map<number, T>();

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
    total_results: Math.max(original.total_results, ranked.length),
    total_pages: Math.max(original.total_pages, ranked.length ? 1 : 0),
  };
}

const searchMovies = (query: string, page: number) =>
  tmdb.search.movies({ query, page });

const searchTv = (query: string, page: number) =>
  tmdb.search.tvShows({ query, page });

async function resolvePerson(
  query: string,
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

    return result.results?.[0] ?? null;
  } catch (error) {
    console.error("Person lookup failed:", error);
    return null;
  }
}

async function resolveKeywords(
  query: string,
): Promise<TmdbKeyword[]> {
  if (!query) return [];

  const terms = query
    .split(/\s+/)
    .filter((term) => term.length > 2)
    .slice(0, 3);

  if (!terms.length) return [];

  const results = await Promise.all(
    terms.map(async (term) => {
      try {
        const params = new URLSearchParams({
          query: term,
          page: "1",
        });

        const response = await tmdbRequest<{
          results: TmdbKeyword[];
        }>("/search/keyword", params);

        return response.results?.[0] ?? null;
      } catch {
        return null;
      }
    }),
  );

  return results.filter(
    (item): item is TmdbKeyword => Boolean(item),
  );
}

function getDateFilters(
  year?: number,
  mode?: "before" | "after" | "exact",
  type?: ContentType,
): Record<string, string> {
  if (!year || !mode) return {};

  const prefix =
    type === "tv" ? "first_air_date" : "primary_release_date";

  if (mode === "exact") {
    return {
      [`${prefix}.gte`]: `${year}-01-01`,
      [`${prefix}.lte`]: `${year}-12-31`,
    };
  }

  if (mode === "before") {
    return {
      [`${prefix}.lte`]: `${year - 1}-12-31`,
    };
  }

  return {
    [`${prefix}.gte`]: `${year + 1}-01-01`,
  };
}

async function getContextualResults(
  query: string,
  type: ContentType,
): Promise<SearchItem[]> {
  const intent = parseSearchIntent(query, type);

  const hasIntent =
    intent.genres.length > 0 ||
    Boolean(intent.year) ||
    Boolean(intent.personQuery) ||
    Boolean(intent.keywordQuery);

  if (!hasIntent) return [];

  const [person, keywords] = await Promise.all([
    intent.personQuery
      ? resolvePerson(intent.personQuery)
      : Promise.resolve(null),
    intent.keywordQuery
      ? resolveKeywords(intent.keywordQuery)
      : Promise.resolve([]),
  ]);

  const params = new URLSearchParams({
    page: "1",
    sort_by: "popularity.desc",
    include_adult: "false",
  });

  if (intent.genres.length) {
    params.set("with_genres", intent.genres.join("|"));
  }

  if (intent.year) {
    Object.entries(
      getDateFilters(intent.year, intent.yearMode, type),
    ).forEach(([key, value]) => {
      params.set(key, value);
    });
  }

  if (person) {
    params.set(
      intent.personRole === "crew" ? "with_crew" : "with_people",
      String(person.id),
    );
  }

  if (keywords.length) {
    params.set(
      "with_keywords",
      keywords.map((keyword) => keyword.id).join("|"),
    );
  }

  try {
    const endpoint =
      type === "movie" ? "/discover/movie" : "/discover/tv";

    const result = await tmdbRequest<SearchPage<SearchItem>>(
      endpoint,
      params,
    );

    return result.results ?? [];
  } catch (error) {
    console.error("Contextual discovery failed:", error);
    return [];
  }
}

function contextualScore(
  item: SearchItem,
  query: string,
  type: ContentType,
): number {
  const intent = parseSearchIntent(query, type);

  let score = 0;

  const matchedGenres = (item.genre_ids ?? []).filter((id) =>
    intent.genres.includes(id),
  ).length;

  if (intent.genres.length) {
    score +=
      0.18 *
      (matchedGenres / intent.genres.length);
  }

  const date =
    type === "movie" ? item.release_date : item.first_air_date;

  if (intent.year && date) {
    const resultYear = Number(date.slice(0, 4));

    if (intent.yearMode === "exact" && resultYear === intent.year) {
      score += 0.2;
    } else if (
      intent.yearMode === "before" &&
      resultYear < intent.year
    ) {
      score += 0.1;
    } else if (
      intent.yearMode === "after" &&
      resultYear > intent.year
    ) {
      score += 0.1;
    }
  }

  const overview = normalizeSearchText(item.overview ?? "");
  const descriptionTerms = intent.keywordQuery
    ?.split(/\s+/)
    .filter((term) => term.length > 2) ?? [];

  if (descriptionTerms.length && overview) {
    const matched = descriptionTerms.filter((term) =>
      overview.includes(term),
    ).length;

    score +=
      0.22 *
      (matched / descriptionTerms.length);
  }

  return score;
}

async function runSearch(
  query: string,
  type: ContentType,
  page: number,
): Promise<SearchPage<SearchItem>> {
  const searchFunction =
    type === "movie" ? searchMovies : searchTv;

  const original = await searchWithRecovery(
    query.trim(),
    page,
    searchFunction,
  );

  if (page !== 1) {
    return original;
  }

  const contextual = await getContextualResults(query, type);

  if (!contextual.length) {
    return original;
  }

  const combined = new Map<number, SearchItem>();

  for (const item of original.results) {
    combined.set(item.id, item);
  }

  for (const item of contextual) {
    if (!combined.has(item.id)) {
      combined.set(item.id, item);
    }
  }

  const ranked = rankSearchResults(
    [...combined.values()],
    query,
  )
    .map((result) => ({
      item: result.item,
      score:
        result.score * 0.65 +
        contextualScore(result.item, query, type),
    }))
    .sort((a, b) => b.score - a.score)
    .map((result) => result.item);

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
      message: "Contextual search results fetched",
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
  limit: number = 10,
): ActionResponse<SearchSuggestion[] | null> => {
  try {
    const normalizedQuery = normalizeSearchText(query);

    if (normalizedQuery.length < 2) {
      return {
        success: true,
        message: "Enter at least two characters",
        data: null,
      };
    }

    const [movies, tvShows] = await Promise.all([
      runSearch(query, "movie", 1),
      runSearch(query, "tv", 1),
    ]);

    const movieSuggestions = rankSearchResults(
      movies.results,
      query,
    )
      .filter((result) => result.score >= 0.3)
      .map(({ item, score }) => ({
        id: item.id,
        title: item.title ?? "",
        type: "movie" as const,
        score,
      }));

    const tvSuggestions = rankSearchResults(
      tvShows.results,
      query,
    )
      .filter((result) => result.score >= 0.3)
      .map(({ item, score }) => ({
        id: item.id,
        title: item.name ?? "",
        type: "tv" as const,
        score,
      }));

    const combined = [...movieSuggestions, ...tvSuggestions];

    const unique = combined.filter(
      (item, index, all) =>
        index ===
        all.findIndex(
          (candidate) =>
            candidate.id === item.id &&
            candidate.type === item.type,
        ),
    );

    unique.sort((a, b) => b.score - a.score);

    return {
      success: true,
      message: "Contextual suggestions fetched",
      data: unique.slice(0, Math.max(1, Math.min(limit, 20))),
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
