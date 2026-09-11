import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildTasteProfile } from "@/utils/personalization/taste-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const ACCOUNT_OBJECT_COOKIE = "ryuflix_tmdb_account_object_id";

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
  genres?: { id: number; name: string }[];
  keywords?: { id: number; name: string }[];
  credits?: {
    cast?: { id: number; name: string; order?: number }[];
    crew?: { id: number; name: string; job?: string; department?: string }[];
  };
  spoken_languages?: { iso_639_1: string; english_name?: string }[];
  production_countries?: { iso_3166_1: string; name?: string }[];
  origin_country?: string[];
};

async function tmdbRequest<T>(endpoint: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://api.themoviedb.org/4${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`TMDB ${response.status}: ${text.slice(0, 500)}`);
  }

  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error("TMDB returned invalid JSON.");
  }
}

async function getAllPages(endpoint: string, accessToken: string) {
  const results: TMDBItem[] = [];
  let page = 1;
  let totalPages = 1;
  let totalResults = 0;

  while (page <= totalPages && page <= 100) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const data = await tmdbRequest<TMDBPage<TMDBItem>>(
      `${endpoint}${separator}page=${page}`,
      accessToken,
    );

    results.push(...(data.results ?? []));
    totalPages = Math.max(1, data.total_pages ?? 1);
    totalResults = data.total_results ?? results.length;
    page++;
  }

  return { results, totalResults };
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

async function enrich(item: TasteItem, accessToken: string) {
  try {
    const endpoint =
      item.mediaType === "movie"
        ? `/movie/${item.id}?append_to_response=credits,keywords`
        : `/tv/${item.id}?append_to_response=credits,keywords`;

    const data = await tmdbRequest<EnrichedItem>(endpoint, accessToken);

    return {
      ...data,
      mediaType: item.mediaType,
      userRating: item.userRating,
      favorite: item.favorite,
      watchlist: item.watchlist,
      genre_ids: item.genre_ids,
    };
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value ?? null;
    const accountObjectId = cookieStore.get(ACCOUNT_OBJECT_COOKIE)?.value ?? null;

    if (!accessToken || !accountObjectId) {
      return NextResponse.json(
        { error: "TMDB is not connected. Connect TMDB first." },
        { status: 401 },
      );
    }

    const account = await tmdbRequest<{
      id?: number;
      username?: string;
      name?: string;
    }>(`/account/${encodeURIComponent(accountObjectId)}`, accessToken);

    const [
      ratedMovies,
      ratedTV,
      favoritesMovies,
      favoritesTV,
      watchlistMovies,
      watchlistTV,
    ] = await Promise.all([
      getAllPages(`/account/${encodeURIComponent(accountObjectId)}/movie/rated?language=en-US&sort_by=created_at.desc`, accessToken),
      getAllPages(`/account/${encodeURIComponent(accountObjectId)}/tv/rated?language=en-US&sort_by=created_at.desc`, accessToken),
      getAllPages(`/account/${encodeURIComponent(accountObjectId)}/movie/favorites?language=en-US&sort_by=created_at.desc`, accessToken),
      getAllPages(`/account/${encodeURIComponent(accountObjectId)}/tv/favorites?language=en-US&sort_by=created_at.desc`, accessToken),
      getAllPages(`/account/${encodeURIComponent(accountObjectId)}/movie/watchlist?language=en-US&sort_by=created_at.desc`, accessToken),
      getAllPages(`/account/${encodeURIComponent(accountObjectId)}/tv/watchlist?language=en-US&sort_by=created_at.desc`, accessToken),
    ]);

    const ratedMovieItems: TasteItem[] = ratedMovies.results.map((item) => ({
      ...item,
      mediaType: "movie",
      userRating: typeof item.rating === "number" ? item.rating : null,
    }));

    const ratedTVItems: TasteItem[] = ratedTV.results.map((item) => ({
      ...item,
      mediaType: "tv",
      userRating: typeof item.rating === "number" ? item.rating : null,
    }));

    const favoriteMovieItems: TasteItem[] = favoritesMovies.results.map((item) => ({
      ...item,
      mediaType: "movie",
      favorite: true,
    }));

    const favoriteTVItems: TasteItem[] = favoritesTV.results.map((item) => ({
      ...item,
      mediaType: "tv",
      favorite: true,
    }));

    const watchlistMovieItems: TasteItem[] = watchlistMovies.results.map((item) => ({
      ...item,
      mediaType: "movie",
      watchlist: true,
    }));

    const watchlistTVItems: TasteItem[] = watchlistTV.results.map((item) => ({
      ...item,
      mediaType: "tv",
      watchlist: true,
    }));

    const allItems = mergeItems([
      ...ratedMovieItems,
      ...ratedTVItems,
      ...favoriteMovieItems,
      ...favoriteTVItems,
      ...watchlistMovieItems,
      ...watchlistTVItems,
    ]);

    const strongest = [...allItems]
      .sort((a, b) => signalScore(b) - signalScore(a))
      .slice(0, 40);

    const enriched: EnrichedItem[] = [];

    for (let i = 0; i < strongest.length; i += 5) {
      const batchResults = await Promise.all(
        strongest.slice(i, i + 5).map((item) => enrich(item, accessToken)),
      );

      for (const item of batchResults) {
        if (item) enriched.push(item);
      }
    }

    const tasteProfile: TasteProfile = buildTasteProfile({
      ratedMovies: ratedMovieItems,
      ratedTV: ratedTVItems,
      favoritesMovies: favoriteMovieItems,
      favoritesTV: favoriteTVItems,
      watchlistMovies: watchlistMovieItems,
      watchlistTV: watchlistTVItems,
      enrichedItems: enriched,
    });

    return NextResponse.json({
      importedAt: new Date().toISOString(),
      account: {
        id: account.id ?? null,
        objectId: accountObjectId,
        username: account.username ?? null,
        name: account.name ?? null,
      },
      totals: {
        ratedMovies: ratedMovies.totalResults,
        ratedTV: ratedTV.totalResults,
        favoritesMovies: favoritesMovies.totalResults,
        favoritesTV: favoritesTV.totalResults,
        watchlistMovies: watchlistMovies.totalResults,
        watchlistTV: watchlistTV.totalResults,
        totalImported: allItems.length,
      },
      samples: {
        ratedMovies: ratedMovies.results.slice(0, 10).map((item) => ({
          id: item.id,
          title: item.title ?? null,
          rating: item.rating ?? null,
          releaseDate: item.release_date ?? null,
        })),
        ratedTV: ratedTV.results.slice(0, 10).map((item) => ({
          id: item.id,
          title: item.name ?? null,
          rating: item.rating ?? null,
          releaseDate: item.first_air_date ?? null,
        })),
      },
      enrichedItems: enriched,
      tasteProfile,
    });
  } catch (error) {
    console.error("TMDB import failed:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TMDB import failed." },
      { status: 500 },
    );
  }
}
