import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  buildTasteProfile,
} from "@/utils/personalization/taste-engine";

import type {
  TasteProfile,
} from "@/utils/personalization/taste-engine";

const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";

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

async function tmdbV4<T>(
  endpoint: string,
  token: string,
): Promise<T> {
  const response = await fetch(
    `https://api.themoviedb.org/4${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `TMDB v4 ${response.status}: ${raw.slice(0, 500)}`,
    );
  }

  return raw
    ? (JSON.parse(raw) as T)
    : ({} as T);
}

async function tmdbV3<T>(
  endpoint: string,
  token: string,
): Promise<T> {
  const response = await fetch(
    `https://api.themoviedb.org/3${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `TMDB v3 ${response.status}: ${raw.slice(0, 500)}`,
    );
  }

  return raw
    ? (JSON.parse(raw) as T)
    : ({} as T);
}

async function getAllPages(
  endpoint: string,
  token: string,
) {
  const results: TMDBItem[] = [];

  let page = 1;
  let totalPages = 1;
  let totalResults = 0;

  while (
    page <= totalPages &&
    page <= MAX_PAGES
  ) {
    const separator =
      endpoint.includes("?")
        ? "&"
        : "?";

    const data =
      await tmdbV4<TMDBPage<TMDBItem>>(
        `${endpoint}${separator}page=${page}&language=en-US`,
        token,
      );

    results.push(
      ...(data.results ?? []),
    );

    totalPages =
      Math.max(
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

    const existing =
      map.get(key);

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

  return Array.from(
    map.values(),
  );
}

function signalScore(
  item: TasteItem,
) {
  let score = 0;

  if (
    typeof item.userRating ===
      "number"
  ) {
    score += Math.abs(
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

async function enrich(
  item: TasteItem,
  token: string,
) {
  try {
    const endpoint =
      item.mediaType === "movie"
        ? `/movie/${item.id}?append_to_response=credits,keywords`
        : `/tv/${item.id}?append_to_response=credits,keywords`;

    const data =
      await tmdbV3<EnrichedItem>(
        endpoint,
        token,
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
      `TMDB enrichment failed for ${item.mediaType}:${item.id}`,
      error,
    );

    return null;
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get(
        ACCESS_COOKIE,
      )?.value;

    const accountId =
      cookieStore.get(
        ACCOUNT_COOKIE,
      )?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "TMDB is not connected. Connect TMDB first.",
        },
        { status: 401 },
      );
    }

    if (!accountId) {
      return NextResponse.json(
        {
          error:
            "TMDB is connected, but its account identifier is missing. Disconnect and reconnect TMDB.",
        },
        { status: 401 },
      );
    }

    /*
     * Verify the authenticated account first.
     */
    const verification =
      await tmdbV4<
        TMDBPage<TMDBItem>
      >(
        `/account/${encodeURIComponent(
          accountId,
        )}/movie/rated?page=1&language=en-US&sort_by=created_at.desc`,
        accessToken,
      );

    /*
     * Fetch every collection.
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
        `/account/${encodeURIComponent(
          accountId,
        )}/movie/rated?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountId,
        )}/tv/rated?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountId,
        )}/movie/favorites?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountId,
        )}/tv/favorites?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountId,
        )}/movie/watchlist?sort_by=created_at.desc`,
        accessToken,
      ),

      getAllPages(
        `/account/${encodeURIComponent(
          accountId,
        )}/tv/watchlist?sort_by=created_at.desc`,
        accessToken,
      ),
    ]);

    /*
     * Convert each collection into the taste-engine
     * format.
     */
    const ratedMovieItems: TasteItem[] =
      ratedMovies.results.map(
        (item) => ({
          ...item,
          mediaType: "movie",
          userRating:
            item.rating ?? null,
        }),
      );

    const ratedTVItems: TasteItem[] =
      ratedTV.results.map(
        (item) => ({
          ...item,
          mediaType: "tv",
          userRating:
            item.rating ?? null,
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
     * Pick the strongest signals for deep metadata.
     */
    const strongest =
      [...allItems]
        .sort(
          (a, b) =>
            signalScore(b) -
            signalScore(a),
        )
        .slice(0, ENRICH_LIMIT);

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

      const results =
        await Promise.all(
          batch.map(
            (item) =>
              enrich(
                item,
                accessToken,
              ),
          ),
        );

      for (const item of results) {
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
        id: accountId,
        objectId: accountId,
        username: null,
        name: null,
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

      verification: {
        ratedMovies:
          verification.total_results ??
          verification.results?.length ??
          0,
      },

      samples: {
        ratedMovies:
          ratedMovies.results
            .slice(0, 10)
            .map(
              (item) => ({
                id: item.id,
                title:
                  item.title ?? null,
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
                  item.name ?? null,
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
