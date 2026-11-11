
"use server";

import { tmdb } from "@/api/tmdb";
import { ActionResponse } from "@/types";
import { isEmpty } from "@/utils/helpers";
import { normalizeSearchText, rankSearchResults } from "@/utils/search";

export type SearchSuggestion = {
  id: number;
  title: string;
  type: "movie" | "tv";
  score: number;
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
      tmdb.search.movies({ query: query.trim(), page: 1 }),
      tmdb.search.tvShows({ query: query.trim(), page: 1 }),
    ]);

    const movieSuggestions: SearchSuggestion[] = rankSearchResults(
      movies.results,
      normalizedQuery,
    )
      .filter((result) => result.score >= 0.35)
      .map(({ item, score }) => ({
        id: item.id,
        title: item.title,
        type: "movie",
        score,
      }));

    const tvSuggestions: SearchSuggestion[] = rankSearchResults(
      tvShows.results,
      normalizedQuery,
    )
      .filter((result) => result.score >= 0.35)
      .map(({ item, score }) => ({
        id: item.id,
        title: item.name,
        type: "tv",
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
      message: "Intelligent search suggestions fetched",
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
