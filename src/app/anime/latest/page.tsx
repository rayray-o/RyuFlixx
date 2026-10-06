import Link from "next/link";
import AnimePosterCard from "@/components/anime/AnimePosterCard";
import AnimeSearchBar from "@/components/anime/AnimeSearchBar";
import {
  getLatestAnime,
} from "@/api/mal";

export const revalidate = 300;

type AnimeLatestPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function AnimeLatestPage(
  {
    searchParams,
  }: AnimeLatestPageProps,
) {
  const query =
    await searchParams;

  const parsedPage =
    Number(query.page);

  const page =
    Number.isFinite(parsedPage) &&
    parsedPage > 0
      ? Math.floor(parsedPage)
      : 1;

  const data =
    await getLatestAnime(
      page,
      24,
    );

  const hasPrevious =
    page > 1;

  const hasNext =
    data.hasNext;

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

        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white md:text-5xl">
              Latest Anime
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-white/55 md:text-base">
              Browse currently airing anime from MyAnimeList.
            </p>
          </div>

          <AnimeSearchBar />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {data.anime.map(
          (item) => (
            <AnimePosterCard
              key={String(item.id)}
              anime={item}
            />
          ),
        )}
      </section>

      <div className="mt-10 flex items-center justify-center gap-3">
        {hasPrevious ? (
          <Link
            href={`/anime/latest?page=${page - 1}`}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            ← Previous
          </Link>
        ) : (
          <span className="rounded-xl border border-white/5 bg-white/[0.02] px-5 py-2.5 text-sm text-white/20">
            ← Previous
          </span>
        )}

        <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/50">
          Page {page}
        </span>

        {hasNext ? (
          <Link
            href={`/anime/latest?page=${page + 1}`}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded-xl border border-white/5 bg-white/[0.02] px-5 py-2.5 text-sm text-white/20">
            Next →
          </span>
        )}
      </div>
    </main>
  );
}
