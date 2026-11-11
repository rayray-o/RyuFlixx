
"use server";

import { tmdb } from "@/api/tmdb";
import { ActionResponse, ContentType } from "@/types";
import { generateSearchVariants, normalizeSearchText, rankSearchResults } from "@/utils/search";
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
};

type SearchFunction<T extends SearchItem> = (
  query: string,
  page: number,
) => Promise<Search<T>>;

async function searchWithRecovery<T extends SearchItem>(
  query: string,
  page: number,
  searchFunction: SearchFunction<T>,
): Promise<Search<T>> {
  const original = await searchFunction(query, page);

  // Only perform recovery on the first page when the original
  // query produces too few candidates.
  if (page !== 1 || original.results.length >= 5) {
    return original;
  }

  const variants = generateSearchVariants(query, 8);

  if (!variants.length) return original;

  const recoveredPages = await Promise.all(
    variants.map(async (variant) => {
      try {
        return await searchFunction(variant, 1);
      } catch (error) {
        console.warn("Search recovery query failed:", variant, error);
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

export const getSearchResults = async (
  query: string,
  type: ContentType,
  page: number = 1,
): ActionResponse<Search<Movie> | Search<TV>> => {
  try {
    const normalizedQuery = normalizeSearchText(query);

    if (normalizedQuery.length < 2) {
      return {
        success: true,
        message: "Enter at least two characters",
        data: null,
      };
    }

    const results =
      type === "movie"
        ? await searchWithRecovery(query.trim(), page, searchMovies)
        : await searchWithRecovery(query.trim(), page, searchTv);

    return {
      success: true,
      message: "Search results fetched",
      data: results,
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
      searchWithRecovery(query.trim(), 1, searchMovies),
      searchWithRecovery(query.trim(), 1, searchTv),
    ]);

    const movieSuggestions: SearchSuggestion[] = rankSearchResults(
      movies.results,
      query,
    )
      .filter((result) => result.score >= 0.35)
      .map(({ item, score }) => ({
        id: item.id,
        title: item.title ?? "",
        type: "movie",
        score,
      }));

    const tvSuggestions: SearchSuggestion[] = rankSearchResults(
      tvShows.results,
      query,
    )
      .filter((result) => result.score >= 0.35)
      .map(({ item, score }) => ({
        id: item.id,
        title: item.name ?? "",
        type: "tv",
        score,
      }));

    const combined = [...movieSuggestions, ...tvSuggestions];

    const unique = combined.filter(
      (item, index, all) =>
        index ===
        all.findIndex(
          (candidate) =>
            candidate.id === item.id && candidate.type === item.type,
        ),
    );

    unique.sort((a, b) => b.score - a.score);

    return {
      success: true,
      message: "Search suggestions fetched",
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
