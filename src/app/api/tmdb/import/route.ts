import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const TMDB_COOKIE = "ryuflix_tmdb_access_token";

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
  media_type?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
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

  if (!response.ok) {
    const errorText = await response.text();

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
  const data = await tmdbRequest<TMDBPage<TMDBItem>>(
    endpoint,
    accessToken,
  );

  return {
    results: data.results ?? [],
    totalResults: data.total_results ?? 0,
    totalPages: data.total_pages ?? 0,
  };
}

export async function POST() {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get(TMDB_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "TMDB is not connected.",
        },
        { status: 401 },
      );
    }

    // Get the authenticated TMDB account.
    const account = await tmdbRequest<{
      id: number;
      username?: string;
      name?: string;
    }>("/account", accessToken);

    const accountId = account.id;

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

    const ratedMovieSamples =
      ratedMovies.results.slice(0, 10).map(
        (movie) => ({
          id: movie.id,
          title: movie.title ?? null,
          rating:
            typeof movie.vote_average === "number"
              ? movie.vote_average
              : null,
          userRating:
            (movie as TMDBItem & {
              rating?: number;
            }).rating ?? null,
          releaseDate:
            movie.release_date ?? null,
        }),
      );

    const ratedTVSamples =
      ratedTV.results.slice(0, 10).map(
        (show) => ({
          id: show.id,
          title: show.name ?? null,
          rating:
            typeof show.vote_average === "number"
              ? show.vote_average
              : null,
          userRating:
            (show as TMDBItem & {
              rating?: number;
            }).rating ?? null,
          releaseDate:
            show.first_air_date ?? null,
        }),
      );

    return NextResponse.json({
      importedAt: new Date().toISOString(),

      account: {
        id: account.id,
        username: account.username ?? null,
        name: account.name ?? null,
      },

      totals: {
        ratedMovies: ratedMovies.totalResults,
        ratedTV: ratedTV.totalResults,
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
        ratedMovies: ratedMovieSamples,
        ratedTV: ratedTVSamples,
      },
    });
  } catch (error) {
    console.error("TMDB import error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import TMDB data.",
      },
      { status: 502 },
    );
  }
        }

