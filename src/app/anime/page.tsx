import AnimeContinueWatching from "@/components/anime/AnimeContinueWatching";
import AnimeHomeList from "@/components/anime/AnimeHomeList";
import AnimeSearchBar from "@/components/anime/AnimeSearchBar";
import {
  getAiringAnime,
  getFavoriteAnime,
  getPopularAnime,
  getTopAnime,
  getTopMovieAnime,
  getTopTvAnime,
  getUpcomingAnime,
} from "@/api/mal";

export const revalidate = 300;

export default async function AnimePage() {
  const [
    topAnime,
    airingAnime,
    popularAnime,
    upcomingAnime,
    topTvAnime,
    topMovieAnime,
    favoriteAnime,
  ] = await Promise.all([
    getTopAnime(1, 24),
    getAiringAnime(1, 24),
    getPopularAnime(1, 24),
    getUpcomingAnime(1, 24),
    getTopTvAnime(1, 24),
    getTopMovieAnime(1, 24),
    getFavoriteAnime(1, 24),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-warning">
          RyuFlix Anime
        </p>

        <h1 className="text-3xl font-bold text-white md:text-5xl">
          Anime
        </h1>

        <p className="mt-3 max-w-2xl text-sm text-white/55 md:text-base">
          Explore anime from the MyAnimeList catalog with dedicated episode playback.
        </p>

        <div className="mt-6">
          <AnimeSearchBar />
        </div>
      </div>

      <div className="flex flex-col gap-12">
        <AnimeContinueWatching />

        <AnimeHomeList
          id="top-anime"
          title="Highest Rated"
          href="/anime/latest?ranking=all"
          anime={topAnime.anime}
        />

        <AnimeHomeList
          id="airing-anime"
          title="Top Airing"
          href="/anime/latest?ranking=airing"
          anime={airingAnime.anime}
        />

        <AnimeHomeList
          id="popular-anime"
          title="Most Popular"
          href="/anime/latest?ranking=bypopularity"
          anime={popularAnime.anime}
        />

        <AnimeHomeList
          id="upcoming-anime"
          title="Upcoming Anime"
          href="/anime/latest?ranking=upcoming"
          anime={upcomingAnime.anime}
        />

        <AnimeHomeList
          id="top-tv-anime"
          title="Top TV Anime"
          href="/anime/latest?ranking=tv"
          anime={topTvAnime.anime}
        />

        <AnimeHomeList
          id="top-movie-anime"
          title="Top Anime Movies"
          href="/anime/latest?ranking=movie"
          anime={topMovieAnime.anime}
        />

        <AnimeHomeList
          id="favorite-anime"
          title="Most Favorited"
          href="/anime/latest?ranking=favorite"
          anime={favoriteAnime.anime}
        />
      </div>
    </main>
  );
      }
