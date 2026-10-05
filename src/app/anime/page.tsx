import AnimeContinueWatching from "@/components/anime/AnimeContinueWatching";
import AnimeHomeList from "@/components/anime/AnimeHomeList";
import AnimeSearchBar from "@/components/anime/AnimeSearchBar";
import {
  getRecentAnime,
} from "@/api/anikoto";

export const revalidate = 300;

export default async function AnimePage() {
  const data =
    await getRecentAnime(
      1,
      24,
    );

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
          Discover anime with dedicated
          episode playback.
        </p>

        <div className="mt-6">
          <AnimeSearchBar />
        </div>
      </div>

      <div className="flex flex-col gap-12">
        <AnimeContinueWatching />

        <AnimeHomeList
          anime={data.anime}
        />
      </div>
    </main>
  );
}
