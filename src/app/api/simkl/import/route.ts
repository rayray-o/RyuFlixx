import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getInitialSimklLibrary,
  getSimklDelta,
} from "@/utils/personalization/simkl";
import { buildTasteProfile } from "@/utils/personalization/taste-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const SIMKL_TOKEN_COOKIE = "ryuflix_simkl_access_token";
const SIMKL_ACTIVITY_COOKIE = "ryuflix_simkl_activity";

type SimklItem = {
  title?: string;
  year?: number;
  rating?: number;
  user_rating?: number;
  watched_at?: string;
  last_watched_at?: string;
  watched?: boolean;
  status?: string;

  ids?: {
    simkl?: number;
    tmdb?: number;
    imdb?: string;
    tvdb?: number;
    mal?: number;
    [key: string]: unknown;
  };

  [key: string]: unknown;
};

type SimklResponse = {
  movies?: SimklItem[];
  shows?: SimklItem[];
  anime?: SimklItem[];
  [key: string]: unknown;
};

type TasteItem = {
  id: number;
  title?: string;
  name?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
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
    `https://api.themoviedb.org/4${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `TMDB ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  try {
    return text
      ? (JSON.parse(text) as T)
      : ({} as T);
  } catch {
    throw new Error(
      "TMDB returned invalid JSON.",
    );
  }
}

function getTmdbAccessToken(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  return (
    cookieStore.get(
      "ryuflix_tmdb_access_token",
    )?.value ?? null
  );
}

function extractItems(
  response: SimklResponse,
) {
  return {
    movies: response.movies ?? [],
    shows: response.shows ?? [],
    anime: response.anime ?? [],
  };
}

function getTmdbId(item: SimklItem) {
  const value = item.ids?.tmdb;

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    /^\d+$/.test(value)
  ) {
    return Number(value);
  }

  return null;
}

function getRating(item: SimklItem) {
  const rating =
    typeof item.user_rating === "number"
      ? item.user_rating
      : typeof item.rating === "number"
        ? item.rating
        : null;

  return rating;
}

function toTasteItem(
  item: SimklItem,
  mediaType: "movie" | "tv",
): TasteItem | null {
  const id = getTmdbId(item);

  if (!id) {
    return null;
  }

  return {
    id,
    title:
      mediaType === "movie"
        ? item.title
        : undefined,
    name:
      mediaType === "tv"
        ? item.title
        : undefined,
    release_date:
      mediaType === "movie" && item.year
        ? `${item.year}-01-01`
        : undefined,
    first_air_date:
      mediaType === "tv" && item.year
        ? `${item.year}-01-01`
        : undefined,
    mediaType,
    userRating: getRating(item),
    watched:
      undefined,
  } as TasteItem;
}

function mergeItems(
  items: TasteItem[],
) {
  const map =
    new Map<string, TasteItem>();

  for (const item of items) {
    const key =
      `${item.mediaType}:${item.id}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...item });
      continue;
    }

    map.set(key, {
      ...existing,

      userRating:
        item.userRating ??
        existing.userRating ??
        null,

      favorite: Boolean(
        existing.favorite ||
          item.favorite,
      ),

      watchlist: Boolean(
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
      mediaType: item.mediaType,
      userRating:
        item.userRating,
      favorite:
        item.favorite,
      watchlist:
        item.watchlist,
    };
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const cookieStore =
      await cookies();

    const simklToken =
      cookieStore.get(
        SIMKL_TOKEN_COOKIE,
      )?.value ?? null;

    if (!simklToken) {
      return NextResponse.json(
        {
          error:
            "Simkl is not connected.",
        },
        { status: 401 },
      );
    }

    const tmdbToken =
      getTmdbAccessToken(
        cookieStore,
      );

    if (!tmdbToken) {
      return NextResponse.json(
        {
          error:
            "TMDB must be connected before importing Simkl data.",
        },
        { status: 400 },
      );
    }

    /*
     * First import:
     *
     * /sync/shows
     * /sync/movies
     * /sync/anime
     *
     * The helper already performs these
     * sequentially.
     */
    const activityCookie =
      cookieStore.get(
        SIMKL_ACTIVITY_COOKIE,
      )?.value ?? null;

    let library:
      | {
          shows: SimklResponse;
          movies: SimklResponse;
          anime: SimklResponse;
        }
      | null = null;

    if (!activityCookie) {
      library =
        await getInitialSimklLibrary(
          simklToken,
        );
    } else {
      /*
       * Incremental sync will be added
       * through the existing activity route.
       *
       * For this first import route we
       * intentionally use the initial
       * library when there is no local
       * imported dataset yet.
       */
      library =
        await getInitialSimklLibrary(
          simklToken,
        );
    }

    const movieItems =
      extractItems(
        library.movies,
      ).movies
        .map((item) =>
          toTasteItem(
            item,
            "movie",
          ),
        )
        .filter(
          (
            item,
          ): item is TasteItem =>
            item !== null,
        );

    const showItems =
      extractItems(
        library.shows,
      ).shows
        .map((item) =>
          toTasteItem(
            item,
            "tv",
          ),
        )
        .filter(
          (
            item,
          ): item is TasteItem =>
            item !== null,
        );

    const animeItems =
      extractItems(
        library.anime,
      ).anime
        .map((item) =>
          toTasteItem(
            item,
            "tv",
          ),
        )
        .filter(
          (
            item,
          ): item is TasteItem =>
            item !== null,
        );

    /*
     * Anime can overlap with the
     * normal TV library, so dedupe by
     * TMDB media type + ID.
     */
    const allItems =
      mergeItems([
        ...movieItems,
        ...showItems,
        ...animeItems,
      ]);

    /*
     * We enrich the strongest items first,
     * exactly like the existing TMDB
     * personalization importer.
     */
    const strongest =
      [...allItems]
        .sort(
          (a, b) =>
            signalScore(b) -
            signalScore(a),
        )
        .slice(0, 40);

    const enriched:
      EnrichedItem[] = [];

    for (
      let i = 0;
      i < strongest.length;
      i += 5
    ) {
      const batch =
        await Promise.all(
          strongest
            .slice(i, i + 5)
            .map((item) =>
              enrich(
                item,
                tmdbToken,
              ),
            ),
        );

      for (const item of batch) {
        if (item) {
          enriched.push(item);
        }
      }
    }

    const ratedMovies =
      movieItems.filter(
        (item) =>
          typeof item.userRating ===
          "number",
      );

    const ratedTV = [
      ...showItems,
      ...animeItems,
    ].filter(
      (item) =>
        typeof item.userRating ===
        "number",
    );

    /*
     * Simkl's sync library is primarily
     * watch/history data here. Favorites
     * and watchlists will be mapped once
     * we wire the corresponding status
     * fields from the exact sync response.
     */
    const tasteProfile:
      TasteProfile =
      buildTasteProfile({
        ratedMovies,
        ratedTV,
        favoritesMovies: [],
        favoritesTV: [],
        watchlistMovies: [],
        watchlistTV: [],
        enrichedItems: enriched,
      });

    return NextResponse.json({
      importedAt:
        new Date().toISOString(),

      totals: {
        movies:
          movieItems.length,
        shows:
          showItems.length,
        anime:
          animeItems.length,
        total:
          allItems.length,
        enriched:
          enriched.length,
      },

      tasteProfile,

      samples: {
        movies:
          movieItems
            .slice(0, 10)
            .map(
              (item) => ({
                id: item.id,
                title:
                  item.title ??
                  null,
                rating:
                  item.userRating ??
                  null,
              }),
            ),

        tv:
          [
            ...showItems,
            ...animeItems,
          ]
            .slice(0, 10)
            .map(
              (item) => ({
                id: item.id,
                title:
                  item.name ??
                  null,
                rating:
                  item.userRating ??
                  null,
              }),
            ),
      },
    });
  } catch (error) {
    console.error(
      "Simkl import failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Simkl import failed.",
      },
      { status: 500 },
    );
  }
    }
