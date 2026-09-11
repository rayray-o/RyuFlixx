import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  buildTasteProfile,
} from "@/utils/personalization/taste-engine";

import type {
  TasteProfile,
} from "@/utils/personalization/taste-engine";

const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const SESSION_COOKIE = "ryuflix_tmdb_session_id";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";
const USERNAME_COOKIE = "ryuflix_tmdb_username";
const NAME_COOKIE = "ryuflix_tmdb_name";

const MAX_PAGES = 100;
const ENRICH_LIMIT = 40;
const BATCH_SIZE = 5;

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

async function tmdbRequest<T>(
  endpoint: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(
    `https://api.themoviedb.org/3${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `TMDB ${response.status}: ${raw.slice(0, 700)}`,
    );
  }

  try {
    return raw
      ? (JSON.parse(raw) as T)
      : ({} as T);
  } catch {
    throw new Error(
      "TMDB returned an invalid JSON response.",
    );
  }
}

async function getAllPages(
  endpoint: string,
  accessToken: string,
) {
  const results: TMDBItem[] = [];

  let page = 1;
  let totalPages = 1;
  let totalResults = 0;

  while (
    page <= totalPages &&
    page <= MAX_PAGES
  ) {
    const separator = endpoint.includes("?")
      ? "&"
      : "?";

    const data =
      await tmdbRequest<TMDBPage<TMDBItem>>(
        `${endpoint}${separator}page=${page}`,
        accessToken,
      );

    const pageResults =
      data.results ?? [];

    results.push(...pageResults);

    totalPages = Math.max(
      1,
      data.total_pages ?? 1,
    );

    totalResults =
      data.total_results ??
      results.length;

    page += 1;
  }

  return {
    results,
    totalResults,
    totalPages,
  };
}

function mergeItems(
  items: TasteItem[],
) {
  const map = new Map<
    string,
    TasteItem
  >();

  for (const item of items) {
    const key =
      `${item.mediaType}:${item.id}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...item,
      });

      continue;
    }

    map.set(key, {
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
    });
  }

  return Array.from(map.values());
}

function signalScore(
  item: TasteItem,
) {
  let score = 0;

  if (
    typeof item.userRating ===
    "number"
  ) {
    score +=
      Math.abs(
        item.userRating - 5,
      ) * 2;
  }

  if (item.favorite) {
    score += 10;
  }

  if (item.watchlist) {
    score += 1;
  }

  return score;
}

async function enrich(
  item: TasteItem,
  accessToken: string,
) {
  try {
    const endpoint =
      item.mediaType === "movie"
        ? `/movie/${item.id}?append_to_response=credits,keywords`
        : `/tv/${item.id}?append_to_response=credits,keywords`;

    const data =
      await tmdbRequest<EnrichedItem>(
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
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get(
        ACCESS_COOKIE,
      )?.value ?? null;

    const sessionId =
      cookieStore.get(
        SESSION_COOKIE,
      )?.value ?? null;

    const accountId =
      cookieStore.get(
        ACCOUNT_COOKIE,
      )?.value ?? null;

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "TMDB is not connected. Connect TMDB first.",
        },
        { status: 401 },
      );
    }

    if (!sessionId || !accountId) {
      return NextResponse.json(
        {
          error:
            "The TMDB connection is incomplete. Disconnect and reconnect TMDB.",
        },
        { status: 401 },
      );
    }

    if (!/^\d+$/.test(accountId)) {
      return NextResponse.json(
        {
          error:
            "The stored TMDB account ID is invalid. Disconnect and reconnect TMDB.",
        },
        { status: 401 },
      );
    }

    /*
     * Validate the actual account/session first.
     */
    const account =
      await tmdbRequest<{
        id: number;
        username?: string;
        name?: string;
      }>(
        `/account/${accountId}?session_id=${encodeURIComponent(
          sessionId,
        )}`,
        accessToken,
      );

    /*
     * Fetch the actual user collections.
     *
     * These are the documented TMDB v3 account
     * endpoints and are authenticated with the
     * user's session_id.
     */
    const [
      ratedMovies,
      ratedTV,
      favoritesMovies,
      favoritesTV,
      watchlistMovies,
      watchlistTV,
    ] = await Promise.all([
      getAllPages(
        `/account/${accountId}/rated/movies?session_id=${encodeURIComponent(
          sessionId,
        )}&language=en-US&sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${accountId}/rated/tv?session_id=${encodeURIComponent(
          sessionId,
        )}&language=en-US&sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${accountId}/favorite/movies?session_id=${encodeURIComponent(
          sessionId,
        )}&language=en-US&sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${accountId}/favorite/tv?session_id=${encodeURIComponent(
          sessionId,
        )}&language=en-US&sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${accountId}/watchlist/movies?session_id=${encodeURIComponent(
          sessionId,
        )}&language=en-US&sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${accountId}/watchlist/tv?session_id=${encodeURIComponent(
          sessionId,
        )}&language=en-US&sort_by=created_at.desc`,
        accessToken,
      ),
    ]);

    const ratedMovieItems: TasteItem[] =
      ratedMovies.results.map(
        (item) => ({
          ...item,
          mediaType: "movie",
          userRating:
            typeof item.rating === "number"
              ? item.rating
              : null,
        }),
      );

    const ratedTVItems: TasteItem[] =
      ratedTV.results.map(
        (item) => ({
          ...item,
          mediaType: "tv",
          userRating:
            typeof item.rating === "number"
              ? item.rating
              : null,
        }),
      );

    const favoriteMovieItems: TasteItem[] =
      favoritesMovies.results.map(
        (item) => ({
          ...item,
          mediaType: "movie",
          favorite: true,
        }),
      );

    const favoriteTVItems: TasteItem[] =
      favoritesTV.results.map(
        (item) => ({
          ...item,
          mediaType: "tv",
          favorite: true,
        }),
      );

    const watchlistMovieItems: TasteItem[] =
      watchlistMovies.results.map(
        (item) => ({
          ...item,
          mediaType: "movie",
          watchlist: true,
        }),
      );

    const watchlistTVItems: TasteItem[] =
      watchlistTV.results.map(
        (item) => ({
          ...item,
          mediaType: "tv",
          watchlist: true,
        }),
      );

    const allItems =
      mergeItems([
        ...ratedMovieItems,
        ...ratedTVItems,
        ...favoriteMovieItems,
        ...favoriteTVItems,
        ...watchlistMovieItems,
        ...watchlistTVItems,
      ]);

    /*
     * Deep-analyze the strongest signals.
     */
    const strongest =
      [...allItems]
        .sort(
          (a, b) =>
            signalScore(b) -
            signalScore(a),
        )
        .slice(
          0,
          ENRICH_LIMIT,
        );

    const enriched: EnrichedItem[] = [];

    for (
      let i = 0;
      i < strongest.length;
      i += BATCH_SIZE
    ) {
      const batch =
        strongest.slice(
          i,
          i + BATCH_SIZE,
        );

      const batchResults =
        await Promise.all(
          batch.map(
            (item) =>
              enrich(
                item,
                accessToken,
              ),
          ),
        );

      for (const item of batchResults) {
        if (item) {
          enriched.push(item);
        }
      }
    }

    const tasteProfile: TasteProfile =
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
          watchlistMovieItems,

        watchlistTV:
          watchlistTVItems,

        enrichedItems:
          enriched,
      });

    return NextResponse.json({
      importedAt:
        new Date().toISOString(),

      account: {
        id: account.id,
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
          favoritesMovies.totalResults,

        favoritesTV:
          favoritesTV.totalResults,

        watchlistMovies:
          watchlistMovies.totalResults,

        watchlistTV:
          watchlistTV.totalResults,
      },

      samples: {
        ratedMovies:
          ratedMovies.results
            .slice(0, 10)
            .map(
              (item) => ({
                id: item.id,
                title:
                  item.title ??
                  null,
                rating:
                  item.vote_average ??
                  null,
                userRating:
                  item.rating ??
                  null,
                releaseDate:
                  item.release_date ??
                  null,
              }),
            ),

        ratedTV:
          ratedTV.results
            .slice(0, 10)
            .map(
              (item) => ({
                id: item.id,
                title:
                  item.name ??
                  null,
                rating:
                  item.vote_average ??
                  null,
                userRating:
                  item.rating ??
                  null,
                releaseDate:
                  item.first_air_date ??
                  null,
              }),
            ),
      },

      enrichedItems:
        enriched,

      tasteProfile,
    });
  } catch (error) {
    console.error(
      "TMDB import failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "TMDB import failed.",
      },
      {
        status: 500,
      },
    );
  }
}
