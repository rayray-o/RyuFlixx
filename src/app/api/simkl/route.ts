import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/utils/env";
import { getInitialSimklLibrary } from "@/utils/personalization/simkl";
import { buildTasteProfile } from "@/utils/personalization/taste-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const SIMKL_TOKEN_COOKIE = "ryuflix_simkl_access_token";

type SimklItem = {
  title?: string;
  year?: number;
  rating?: number;
  user_rating?: number;
  ids?: {
    tmdb?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type SimklSyncResponse = {
  movies?: SimklItem[];
  shows?: SimklItem[];
  anime?: SimklItem[];
  [key: string]: unknown;
};

type TasteItem = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  mediaType: "movie" | "tv";
  userRating?: number | null;
  favorite?: boolean;
  watchlist?: boolean;
};

type EnrichedItem = TasteItem & {
  genres?: { id: number; name: string }[];
  keywords?: { id: number; name: string }[];
  credits?: {
    cast?: { id: number; name: string; order?: number }[];
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

async function tmdbRequest<T>(endpoint: string) {
  const response = await fetch(
    `https://api.themoviedb.org/3${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `TMDB ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

function getTmdbId(item: SimklItem) {
  const value = item.ids?.tmdb;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function getRating(item: SimklItem) {
  if (
    typeof item.user_rating === "number" &&
    Number.isFinite(item.user_rating)
  ) {
    return item.user_rating;
  }

  if (
    typeof item.rating === "number" &&
    Number.isFinite(item.rating)
  ) {
    return item.rating;
  }

  return null;
}

function toTasteItem(
  item: SimklItem,
  mediaType: "movie" | "tv",
): TasteItem | null {
  const id = getTmdbId(item);

  if (!id) return null;

  return {
    id,
    title: mediaType === "movie" ? item.title : undefined,
    name: mediaType === "tv" ? item.title : undefined,
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
  };
}

function mergeItems(items: TasteItem[]) {
  const map = new Map<string, TasteItem>();

  for (const item of items) {
    const key = `${item.mediaType}:${item.id}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...item });
      continue;
    }

    map.set(key, {
      ...existing,
      userRating: item.userRating ?? existing.userRating ?? null,
      favorite: Boolean(existing.favorite || item.favorite),
      watchlist: Boolean(existing.watchlist || item.watchlist),
    });
  }

  return Array.from(map.values());
}

function signalScore(item: TasteItem) {
  let score = 0;

  if (typeof item.userRating === "number") {
    score += Math.abs(item.userRating - 5) * 2;
  }

  if (item.favorite) score += 10;
  if (item.watchlist) score += 1;

  return score;
}

async function enrich(item: TasteItem) {
  try {
    const endpoint =
      item.mediaType === "movie"
        ? `/movie/${item.id}?append_to_response=credits,keywords`
        : `/tv/${item.id}?append_to_response=credits,keywords`;

    const data = await tmdbRequest<EnrichedItem>(endpoint);

    return {
      ...data,
      mediaType: item.mediaType,
      userRating: item.userRating,
      favorite: item.favorite,
      watchlist: item.watchlist,
    };
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const simklToken =
      cookieStore.get(SIMKL_TOKEN_COOKIE)?.value ?? null;

    if (!simklToken) {
      return NextResponse.json(
        { error: "Simkl is not connected." },
        { status: 401 },
      );
    }

    /*
     * Simkl is an independent personalization source.
     * The user's TMDB account connection is NOT required.
     * RyuFlix's existing TMDB access token is used only
     * to enrich Simkl's TMDB IDs with metadata.
     */
    const library = await getInitialSimklLibrary(simklToken);

    const movies = (library.movies.movies ?? [])
      .map((item) => toTasteItem(item, "movie"))
      .filter((item): item is TasteItem => item !== null);

    const shows = (library.shows.shows ?? [])
      .map((item) => toTasteItem(item, "tv"))
      .filter((item): item is TasteItem => item !== null);

    const anime = (library.anime.anime ?? [])
      .map((item) => toTasteItem(item, "tv"))
      .filter((item): item is TasteItem => item !== null);

    const allItems = mergeItems([
      ...movies,
      ...shows,
      ...anime,
    ]);

    const strongest = [...allItems]
      .sort((a, b) => signalScore(b) - signalScore(a))
      .slice(0, 40);

    const enriched: EnrichedItem[] = [];

    for (let i = 0; i < strongest.length; i += 5) {
      const batch = await Promise.all(
        strongest.slice(i, i + 5).map(enrich),
      );

      for (const item of batch) {
        if (item) enriched.push(item);
      }
    }

    const ratedMovies = movies.filter(
      (item) => typeof item.userRating === "number",
    );

    const ratedTV = [...shows, ...anime].filter(
      (item) => typeof item.userRating === "number",
    );

    const tasteProfile: TasteProfile = buildTasteProfile({
      ratedMovies,
      ratedTV,
      favoritesMovies: [],
      favoritesTV: [],
      watchlistMovies: [],
      watchlistTV: [],
      enrichedItems: enriched,
    });

    return NextResponse.json({
      importedAt: new Date().toISOString(),
      totals: {
        movies: movies.length,
        shows: shows.length,
        anime: anime.length,
        total: allItems.length,
        enriched: enriched.length,
      },
      tasteProfile,
      samples: {
        movies: movies.slice(0, 10).map((item) => ({
          id: item.id,
          title: item.title ?? null,
          rating: item.userRating ?? null,
        })),
        tv: [...shows, ...anime].slice(0, 10).map((item) => ({
          id: item.id,
          title: item.name ?? null,
          rating: item.userRating ?? null,
        })),
      },
    });
  } catch (error) {
    console.error("Simkl import failed:", error);

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
