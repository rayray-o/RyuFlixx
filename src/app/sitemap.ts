
import type { MetadataRoute } from "next";
import { tmdb } from "@/api/tmdb";

const BASE_URL = "https://ryuflix.vercel.app";
const MAX_PAGES_PER_LIST = 5;

type IdPage = {
  results: { id: number }[];
  total_pages: number;
};

async function getMoviePages(
  query: (page: number) => Promise<IdPage>,
): Promise<IdPage[]> {
  let firstPage: IdPage;

  try {
    firstPage = await query(1);
  } catch {
    return [];
  }

  const totalPages = Math.min(
    firstPage.total_pages || 1,
    MAX_PAGES_PER_LIST,
  );

  if (totalPages <= 1) {
    return [firstPage];
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, async (_, index) => {
      try {
        return await query(index + 2);
      } catch {
        return null;
      }
    }),
  );

  return [
    firstPage,
    ...remainingPages.filter(
      (page): page is IdPage => page !== null,
    ),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/discover`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/search`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/library`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/history`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

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
      tmdb.trending.trending("movie", "day", { page }),
    ),
    getMoviePages((page) =>
      tmdb.trending.trending("movie", "week", { page }),
    ),
    getMoviePages((page) =>
      tmdb.movies.popular({ page }),
    ),
    getMoviePages((page) =>
      tmdb.movies.nowPlaying({ page }),
    ),
    getMoviePages((page) =>
      tmdb.movies.upcoming({ page }),
    ),
    getMoviePages((page) =>
      tmdb.movies.topRated({ page }),
    ),
    getMoviePages((page) =>
      tmdb.trending.trending("tv", "day", { page }),
    ),
    getMoviePages((page) =>
      tmdb.trending.trending("tv", "week", { page }),
    ),
    getMoviePages((page) =>
      tmdb.tvShows.popular({ page }),
    ),
    getMoviePages((page) =>
      tmdb.tvShows.onTheAir({ page }),
    ),
    getMoviePages((page) =>
      tmdb.tvShows.topRated({ page }),
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
      if (movie.id) movieIds.add(movie.id);
    }
  }

  for (const page of tvLists) {
    for (const show of page.results) {
      if (show.id) tvIds.add(show.id);
    }
  }

  const movieRoutes: MetadataRoute.Sitemap = [
    ...movieIds,
  ].map((id) => ({
    url: `${BASE_URL}/movie/${id}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const tvRoutes: MetadataRoute.Sitemap = [
    ...tvIds,
  ].map((id) => ({
    url: `${BASE_URL}/tv/${id}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    ...staticRoutes,
    ...movieRoutes,
    ...tvRoutes,
  ];
}
