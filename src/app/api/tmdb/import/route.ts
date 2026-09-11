import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  buildTasteProfile,
} from "@/utils/personalization/taste-engine";

import type {
  TasteProfile,
} from "@/utils/personalization/taste-engine";

const TMDB_COOKIE =
  "ryuflix_tmdb_access_token";

const MAX_PAGES_PER_COLLECTION = 100;

type TMDBPage<T> = {
  page?: number;
  total_pages?: number;
  total_results?: number;
  results?: T[];
};

type TMDBItem = {
  id: number;
  title?: string;
  name?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  rating?: number;
};

type TasteItem = TMDBItem & {
  mediaType: "movie" | "tv";
  userRating?: number | null;
  favorite?: boolean;
  watchlist?: boolean;
};

type EnrichedItem = TasteItem & {
  genres?: {
    id: number;
    name: string;
  }[];

  keywords?: {
    id: number;
    name: string;
  }[];

  credits?: {
    cast?: {
      id: number;
      name: string;
      order?: number;
    }[];

    crew?: {
      id: number;
      name: string;
      job?: string;
      department?: string;
    }[];
  };

  spoken_languages?: {
    iso_639_1: string;
    english_name?: string;
  }[];

  production_countries?: {
    iso_3166_1: string;
    name?: string;
  }[];

  origin_country?: string[];
};

type TMDBAccount = {
  id?: number;
  account_object_id?: string;
  username?: string;
  name?: string;
};

async function tmdbRequest<T>(
  endpoint: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(
    `https://api.themoviedb.org/4${endpoint}`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const rawText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `TMDB request failed (${response.status}): ${rawText}`,
    );
  }

  try {
    return rawText
      ? (JSON.parse(rawText) as T)
      : ({} as T);
  } catch {
    throw new Error(
      "TMDB returned an invalid JSON response.",
    );
  }
}

/**
 * Fetch every page of a TMDB v4 collection.
 *
 * TMDB exposes `page` and `total_pages`
 * on these account collection endpoints.
 */
async function getAllPages(
  endpoint: string,
  accessToken: string,
) {
  const results: TMDBItem[] = [];

  let page = 1;
  let totalPages = 1;
  let totalResults = 0;

  while (
    page <=
      totalPages &&
    page <=
      MAX_PAGES_PER_COLLECTION
  ) {
    const separator =
      endpoint.includes("?")
        ? "&"
        : "?";

    const data =
      await tmdbRequest<
        TMDBPage<TMDBItem>
      >(
        `${endpoint}${separator}page=${page}&language=en-US`,
        accessToken,
      );

    const pageResults =
      data.results ?? [];

    results.push(
      ...pageResults,
    );

    totalPages =
      Math.max(
        1,
        data.total_pages ?? 1,
      );

    totalResults =
      data.total_results ??
      results.length;

    if (
      page >=
      totalPages
    ) {
      break;
    }

    page += 1;
  }

  return {
    results,
    totalResults,
    totalPages,
  };
}

/**
 * Deeply enrich a title with
 * genres, keywords, cast and crew.
 */
async function enrichItem(
  item: TasteItem,
  accessToken: string,
): Promise<EnrichedItem | null> {
  try {
    const endpoint =
      item.mediaType === "movie"
        ? `/movie/${item.id}?append_to_response=credits,keywords`
        : `/tv/${item.id}?append_to_response=credits,keywords`;

    const data =
      await tmdbRequest<
        EnrichedItem
      >(
        endpoint,
        accessToken,
      );

    return {
      ...data,

      mediaType:
        item.mediaType,

      userRating:
        item.userRating,

      favorite:
        item.favorite,

      watchlist:
        item.watchlist,

      genre_ids:
        item.genre_ids,
    };
  } catch (error) {
    console.error(
      `Failed to enrich ${item.mediaType} ${item.id}:`,
      error,
    );

    return null;
  }
}

/**
 * Merge duplicate titles coming from
 * ratings, favorites and watchlists.
 */
function dedupeItems(
  items: TasteItem[],
) {
  const map = new Map<
    string,
    TasteItem
  >();

  for (const item of items) {
    const key =
      `${item.mediaType}:${item.id}`;

    const existing =
      map.get(key);

    if (!existing) {
      map.set(
        key,
        {
          ...item,
        },
      );

      continue;
    }

    map.set(
      key,
      {
        ...existing,

        userRating:
          item.userRating ??
          existing.userRating ??
          null,

        favorite:
          Boolean(
            existing.favorite ||
              item.favorite,
          ),

        watchlist:
          Boolean(
            existing.watchlist ||
              item.watchlist,
          ),
      },
    );
  }

  return Array.from(
    map.values(),
  );
}

/**
 * Give the titles with the strongest
 * taste signals priority for enrichment.
 */
function enrichmentScore(
  item: TasteItem,
) {
  let score = 0;

  if (
    item.userRating != null
  ) {
    score +=
      Math.abs(
        item.userRating - 5,
      );
  }

  if (item.favorite) {
    score += 5;
  }

  if (item.watchlist) {
    score += 1;
  }

  return score;
}

export async function POST() {
  try {
    /*
     * RyuFlix does not have its own
     * account/login system.
     *
     * The user's TMDB OAuth token is
     * stored in this HttpOnly cookie.
     */
    const cookieStore =
      await cookies();

    const accessToken =
      cookieStore.get(
        TMDB_COOKIE,
      )?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "TMDB is not connected.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * Verify the TMDB access token
     * and retrieve the v4 account object ID.
     */
    const account =
      await tmdbRequest<
        TMDBAccount
      >(
        "/account",
        accessToken,
      );

    const accountObjectId =
      account.account_object_id;

    if (
      !accountObjectId
    ) {
      return NextResponse.json(
        {
          error:
            "TMDB connected successfully, but TMDB did not return an account object ID.",
        },
        {
          status: 502,
        },
      );
    }

    /*
     * IMPORTANT:
     *
     * These are TMDB v4 account endpoints.
     * We use account_object_id rather than
     * the old numeric v3 account ID.
     *
     * Each collection is fully paginated.
     */
    const [
      ratedMovies,
      ratedTV,
      favoriteMovies,
      favoriteTV,
      movieWatchlist,
      tvWatchlist,
    ] = await Promise.all([
      getAllPages(
        `/account/${encodeURIComponent(
          accountObjectId,
        )}/movie/rated?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountObjectId,
        )}/tv/rated?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountObjectId,
        )}/movie/favorites?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountObjectId,
        )}/tv/favorites?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountObjectId,
        )}/movie/watchlist?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountObjectId,
        )}/tv/watchlist?sort_by=created_at.desc`,
        accessToken,
      ),
    ]);

    /*
     * Convert TMDB collections into the
     * common Taste Engine format.
     */
    const ratedMovieItems:
      TasteItem[] =
      ratedMovies.results.map(
        (movie) => ({
          ...movie,

          mediaType:
            "movie",

          userRating:
            movie.rating ??
            null,
        }),
      );

    const ratedTVItems:
      TasteItem[] =
      ratedTV.results.map(
        (show) => ({
          ...show,

          mediaType:
            "tv",

          userRating:
            show.rating ??
            null,
        }),
      );

    const favoriteMovieItems:
      TasteItem[] =
      favoriteMovies.results.map(
        (movie) => ({
          ...movie,

          mediaType:
            "movie",

          favorite:
            true,
        }),
      );

    const favoriteTVItems:
      TasteItem[] =
      favoriteTV.results.map(
        (show) => ({
          ...show,

          mediaType:
            "tv",

          favorite:
            true,
        }),
      );

    const movieWatchlistItems:
      TasteItem[] =
      movieWatchlist.results.map(
        (movie) => ({
          ...movie,

          mediaType:
            "movie",

          watchlist:
            true,
        }),
      );

    const tvWatchlistItems:
      TasteItem[] =
      tvWatchlist.results.map(
        (show) => ({
          ...show,

          mediaType:
            "tv",

          watchlist:
            true,
        }),
      );

    /*
     * Merge titles appearing in multiple
     * collections.
     */
    const allItems =
      dedupeItems([
        ...ratedMovieItems,
        ...ratedTVItems,
        ...favoriteMovieItems,
        ...favoriteTVItems,
        ...movieWatchlistItems,
        ...tvWatchlistItems,
      ]);

    /*
     * Only deeply enrich the strongest
     * 30 signals so a huge TMDB library
     * doesn't cause hundreds of API calls.
     */
    const strongestItems =
      [...allItems]
        .sort(
          (a, b) =>
            enrichmentScore(b) -
            enrichmentScore(a),
        )
        .slice(0, 30);

    const enrichedResults:
      (
        | EnrichedItem
        | null
      )[] = [];

    /*
     * Process enrichment in batches
     * instead of firing all requests at once.
     */
    const batchSize =
      5;

    for (
      let i = 0;
      i <
      strongestItems.length;
      i += batchSize
    ) {
      const batch =
        strongestItems.slice(
          i,
          i + batchSize,
        );

      const batchResults =
        await Promise.all(
          batch.map(
            (item) =>
              enrichItem(
                item,
                accessToken,
              ),
          ),
        );

      enrichedResults.push(
        ...batchResults,
      );
    }

    const enrichedItems =
      enrichedResults.filter(
        (
          item,
        ): item is EnrichedItem =>
          item !== null,
      );

    /*
     * Build the RyuFlix taste profile.
     */
    const tasteProfile:
      TasteProfile =
      buildTasteProfile({
        ratedMovies:
          ratedMovieItems,

        ratedTV:
          ratedTVItems,

        favoritesMovies:
          favoriteMovieItems,

        favoritesTV:
          favoriteTVItems,

        watchlistMovies:
          movieWatchlistItems,

        watchlistTV:
          tvWatchlistItems,

        enrichedItems,
      });

    /*
     * Small sample for debugging/display.
     */
    const ratedMovieSamples =
      ratedMovies.results
        .slice(0, 10)
        .map(
          (movie) => ({
            id:
              movie.id,

            title:
              movie.title ??
              null,

            rating:
              typeof movie.vote_average ===
              "number"
                ? movie.vote_average
                : null,

            userRating:
              movie.rating ??
              null,

            releaseDate:
              movie.release_date ??
              null,
          }),
        );

    const ratedTVSamples =
      ratedTV.results
        .slice(0, 10)
        .map(
          (show) => ({
            id:
              show.id,

            title:
              show.name ??
              null,

            rating:
              typeof show.vote_average ===
              "number"
                ? show.vote_average
                : null,

            userRating:
              show.rating ??
              null,

            releaseDate:
              show.first_air_date ??
              null,
          }),
        );

    return NextResponse.json({
      importedAt:
        new Date().toISOString(),

      account: {
        id:
          account.id ??
          null,

        objectId:
          accountObjectId,

        username:
          account.username ??
          null,

        name:
          account.name ??
          null,
      },

      totals: {
        ratedMovies:
          ratedMovies.totalResults,

        ratedTV:
          ratedTV.totalResults,

        favoritesMovies:
          favoriteMovies.totalResults,

        favoritesTV:
          favoriteTV.totalResults,

        watchlistMovies:
          movieWatchlist.totalResults,

        watchlistTV:
          tvWatchlist.totalResults,
      },

      pagination: {
        ratedMoviesPages:
          ratedMovies.totalPages,

        ratedTVPages:
          ratedTV.totalPages,

        favoritesMoviesPages:
          favoriteMovies.totalPages,

        favoritesTVPages:
          favoriteTV.totalPages,

        watchlistMoviesPages:
          movieWatchlist.totalPages,

        watchlistTVPages:
          tvWatchlist.totalPages,
      },

      samples: {
        ratedMovies:
          ratedMovieSamples,

        ratedTV:
          ratedTVSamples,
      },

      enrichedItems:
        enrichedItems.length,

      tasteProfile,
    });
  } catch (error) {
    console.error(
      "TMDB import error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import TMDB data.",
      },
      {
        status: 502,
      },
    );
  }
        }
