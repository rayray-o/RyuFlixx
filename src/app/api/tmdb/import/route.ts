import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  buildTasteProfile,
} from "@/utils/personalization/taste-engine";

import type {
  TasteProfile,
} from "@/utils/personalization/taste-engine";

import {
  createClient,
} from "@/utils/supabase/server";

const TMDB_COOKIE =
  "ryuflix_tmdb_access_token";

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
};

type TasteItem = TMDBItem & {
  mediaType: "movie" | "tv";
  userRating?: number | null;
  favorite?: boolean;
  watchlist?: boolean;
};

type EnrichedItem =
  TasteItem & {
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

async function tmdbRequest<T>(
  endpoint: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(
    `https://api.themoviedb.org/3${endpoint}`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `TMDB request failed (${response.status}): ${errorText}`,
    );
  }

  return response.json();
}

async function getCollection(
  endpoint: string,
  accessToken: string,
) {
  const data =
    await tmdbRequest<
      TMDBPage<TMDBItem>
    >(
      endpoint,
      accessToken,
    );

  return {
    results:
      data.results ?? [],

    totalResults:
      data.total_results ?? 0,

    totalPages:
      data.total_pages ?? 0,
  };
}

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

export async function POST() {
  try {
    /*
     * RyuFlix authentication.
     *
     * The taste profile belongs to
     * the RyuFlix account, not merely
     * the TMDB account.
     */
    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to RyuFlix.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * TMDB authentication.
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

    const account =
      await tmdbRequest<{
        id: number;
        username?: string;
        name?: string;
      }>(
        "/account",
        accessToken,
      );

    const accountId =
      account.id;

    /*
     * Pull the user's TMDB
     * collections.
     */
    const [
      ratedMovies,
      ratedTV,
      favoriteMovies,
      favoriteTV,
      movieWatchlist,
      tvWatchlist,
    ] = await Promise.all([
      getCollection(
        `/account/${accountId}/rated/movies?sort_by=created_at.desc`,
        accessToken,
      ),

      getCollection(
        `/account/${accountId}/rated/tv?sort_by=created_at.desc`,
        accessToken,
      ),

      getCollection(
        `/account/${accountId}/favorite/movies?sort_by=created_at.desc`,
        accessToken,
      ),

      getCollection(
        `/account/${accountId}/favorite/tv?sort_by=created_at.desc`,
        accessToken,
      ),

      getCollection(
        `/account/${accountId}/watchlist/movies?sort_by=created_at.desc`,
        accessToken,
      ),

      getCollection(
        `/account/${accountId}/watchlist/tv?sort_by=created_at.desc`,
        accessToken,
      ),
    ]);

    const ratedMovieItems:
      TasteItem[] =
      ratedMovies.results.map(
        (movie) => ({
          ...movie,

          mediaType:
            "movie",

          userRating:
            (
              movie as TMDBItem & {
                rating?: number;
              }
            ).rating ??
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
            (
              show as TMDBItem & {
                rating?: number;
              }
            ).rating ??
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
     * Merge duplicate titles so a movie
     * can simultaneously have a rating,
     * favourite flag and watchlist flag.
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
     * signals to keep refreshes reasonable.
     */
    const strongestItems =
      [...allItems]
        .sort((a, b) => {
          const score =
            (item: TasteItem) => {
              let value = 0;

              if (
                item.userRating != null
              ) {
                value +=
                  Math.abs(
                    item.userRating -
                      5,
                  );
              }

              if (
                item.favorite
              ) {
                value += 5;
              }

              if (
                item.watchlist
              ) {
                value += 1;
              }

              return value;
            };

          return (
            score(b) -
            score(a)
          );
        })
        .slice(0, 30);

    const enrichedResults:
      (
        | EnrichedItem
        | null
      )[] = [];

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

      const results =
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
        ...results,
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
     * Generate the RyuFlix taste
     * profile.
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
     * SAVE IT.
     *
     * This is the actual 3A.2 step.
     *
     * We deliberately store the derived
     * profile and lightweight source
     * information — never the TMDB
     * access token.
     */
    const {
      error: saveError,
    } =
      await supabase
        .from(
          "taste_profiles",
        )
        .upsert(
          {
            user_id:
              user.id,

            profile:
              tasteProfile,

            source_data: {
              provider:
                "tmdb",

              tmdbAccountId:
                accountId,

              importedAt:
                new Date().toISOString(),

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

              enrichedItems:
                enrichedItems.length,
            },

            version:
              tasteProfile.version,
          },
          {
            onConflict:
              "user_id",
          },
        );

    if (saveError) {
      console.error(
        "Failed to save taste profile:",
        saveError,
      );

      return NextResponse.json(
        {
          error:
            "Taste profile was generated but could not be saved.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Keep the existing useful response
     * data so the current Personalize
     * page continues working.
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
              (
                movie as TMDBItem & {
                  rating?: number;
                }
              ).rating ??
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
              (
                show as TMDBItem & {
                  rating?: number;
                }
              ).rating ??
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
          account.id,

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

      samples: {
        ratedMovies:
          ratedMovieSamples,

        ratedTV:
          ratedTVSamples,
      },

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
