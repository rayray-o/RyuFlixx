import Link from "next/link";
import AnimePosterCard from "@/components/anime/AnimePosterCard";
import AnimeSearchBar from "@/components/anime/AnimeSearchBar";
import {
  getRecentAnime,
  getAnimeTitle,
} from "@/api/anikoto";

export const revalidate = 300;

type AnimeSearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function AnimeSearchPage(
  {
    searchParams,
  }: AnimeSearchPageProps,
) {
  const query =
    await searchParams;

  const search =
    query.q?.trim() ?? "";

  let results =
    search.length > 0
      ? (
          await getRecentAnime(
            1,
            100,
          )
        ).anime.filter(
          (anime) => {
            const haystack =
              [
                anime.title,
                anime.name,
                anime.romaji,
                anime.alternative,
                anime.native,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(
              search.toLowerCase(),
            );
          },
        )
      : [];

  results =
    results.slice(0, 60);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12">
      <div className="mb-8">
        <Link
          href="/anime"
          className="mb-5 inline-flex text-sm text-white/45 transition-colors hover:text-white"
        >
          ← Anime
        </Link>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-warning">
          RyuFlix Anime
        </p>

        <h1 className="text-3xl font-bold text-white md:text-5xl">
          Search Anime
        </h1>

        <div className="mt-6">
          <AnimeSearchBar
            defaultValue={search}
          />
        </div>
      </div>

      {search.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/45">
            Search for an anime to get started.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-warning">
            No Results
          </p>

          <h2 className="mt-2 text-xl font-bold text-white">
            Nothing matched “{search}”
          </h2>

          <p className="mt-2 text-sm text-white/45">
            Try another title or spelling.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <p className="text-sm text-white/45">
              {results.length} result
              {results.length === 1
                ? ""
                : "s"} for{" "}
              <span className="font-semibold text-white">
                “{search}”
              </span>
            </p>
          </div>

          <section className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map(
              (anime) => (
                <AnimePosterCard
                  key={String(
                    anime.id,
                  )}
                  anime={anime}
                />
              ),
            )}
          </section>
        </>
      )}
    </main>
  );
}
