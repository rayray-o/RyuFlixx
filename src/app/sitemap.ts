import type { MetadataRoute } from "next";
import { tmdb } from "@/api/tmdb";

const BASE_URL =
  "https://ryuflix.vercel.app";

const MAX_PAGES_PER_LIST = 5;

async function getMoviePages(
  query: (page: number) => Promise<{
    results: { id: number }[];
    total_pages: number;
  }>,
) {
  const firstPage = await query(1);

  const totalPages = Math.min(
    firstPage.total_pages || 1,
    MAX_PAGES_PER_LIST,
  );

  const remainingPages =
    totalPages > 1
      ? await Promise.all(
          Array.from(
            { length: totalPages - 1 },
            (_, index) =>
              query(index + 2),
          ),
        )
      : [];

  return [
    firstPage,
    ...remainingPages,
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/discover`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/library`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  try {
    const [
      trendingMoviesToday,
      trendingMoviesWeek,
      popularMovies,
      nowPlayingMovies,
      upcomingMovies,
      topRatedMovies,
      trendingTvToday,
      trendingTvWeek,
      popularTv,
      onTheAirTv,
      topRatedTv,
    ] = await Promise.all([
      getMoviePages((page) =>
        tmdb.trending.trending(
          "movie",
          "day",
          { page },
        ),
      ),

      getMoviePages((page) =>
        tmdb.trending.trending(
          "movie",
          "week",
          { page },
        ),
      ),

      getMoviePages((page) =>
        tmdb.movies.popular(page),
      ),

      getMoviePages((page) =>
        tmdb.movies.nowPlaying(page),
      ),

      getMoviePages((page) =>
        tmdb.movies.upcoming(page),
      ),

      getMoviePages((page) =>
        tmdb.movies.topRated(page),
      ),

      getMoviePages((page) =>
        tmdb.trending.trending(
          "tv",
          "day",
          { page },
        ),
      ),

      getMoviePages((page) =>
        tmdb.trending.trending(
          "tv",
          "week",
          { page },
        ),
      ),

      getMoviePages((page) =>
        tmdb.tvShows.popular(page),
      ),

      getMoviePages((page) =>
        tmdb.tvShows.onTheAir(page),
      ),

      getMoviePages((page) =>
        tmdb.tvShows.topRated(page),
      ),
    ]);

    const movieIds = new Set<number>();
    const tvIds = new Set<number>();

    const movieLists = [
      ...trendingMoviesToday,
      ...trendingMoviesWeek,
      ...popularMovies,
      ...nowPlayingMovies,
      ...upcomingMovies,
      ...topRatedMovies,
    ];

    const tvLists = [
      ...trendingTvToday,
      ...trendingTvWeek,
      ...popularTv,
      ...onTheAirTv,
      ...topRatedTv,
    ];

    for (const page of movieLists) {
      for (const movie of page.results) {
        if (movie.id) {
          movieIds.add(movie.id);
        }
      }
    }

    for (const page of tvLists) {
      for (const show of page.results) {
        if (show.id) {
          tvIds.add(show.id);
        }
      }
    }

    const movieRoutes: MetadataRoute.Sitemap =
      Array.from(movieIds).map((id) => ({
        url: `${BASE_URL}/movie/${id}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    const tvRoutes: MetadataRoute.Sitemap =
      Array.from(tvIds).map((id) => ({
        url: `${BASE_URL}/tv/${id}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    return [
      ...staticRoutes,
      ...movieRoutes,
      ...tvRoutes,
    ];
  } catch {
    return staticRoutes;
  }
}
