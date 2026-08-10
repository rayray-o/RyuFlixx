import type { MetadataRoute } from "next";
import { tmdb } from "@/api/tmdb";

const BASE_URL = "https://ryuflix.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/discover`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/library`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
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
      tmdb.trending.trending("movie", "day"),
      tmdb.trending.trending("movie", "week"),
      tmdb.movies.popular(),
      tmdb.movies.nowPlaying(),
      tmdb.movies.upcoming(),
      tmdb.movies.topRated(),

      tmdb.trending.trending("tv", "day"),
      tmdb.trending.trending("tv", "week"),
      tmdb.tvShows.popular(),
      tmdb.tvShows.onTheAir(),
      tmdb.tvShows.topRated(),
    ]);

    const movieIds = new Set<number>();
    const tvIds = new Set<number>();

    const movieLists = [
      trendingMoviesToday.results,
      trendingMoviesWeek.results,
      popularMovies.results,
      nowPlayingMovies.results,
      upcomingMovies.results,
      topRatedMovies.results,
    ];

    const tvLists = [
      trendingTvToday.results,
      trendingTvWeek.results,
      popularTv.results,
      onTheAirTv.results,
      topRatedTv.results,
    ];

    for (const list of movieLists) {
      for (const movie of list) {
        if (movie.id) {
          movieIds.add(movie.id);
        }
      }
    }

    for (const list of tvLists) {
      for (const show of list) {
        if (show.id) {
          tvIds.add(show.id);
        }
      }
    }

    const movieRoutes: MetadataRoute.Sitemap = Array.from(movieIds).map(
      (id) => ({
        url: `${BASE_URL}/movie/${id}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      })
    );

    const tvRoutes: MetadataRoute.Sitemap = Array.from(tvIds).map((id) => ({
      url: `${BASE_URL}/tv/${id}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticRoutes, ...movieRoutes, ...tvRoutes];
  } catch {
    // If TMDB is temporarily unavailable,
    // keep the sitemap valid with the static pages.
    return staticRoutes;
  }
}
