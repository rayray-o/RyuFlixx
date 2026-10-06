import Link from "next/link";
import AnimePosterCard from "@/components/anime/AnimePosterCard";
import AnimeSearchBar from "@/components/anime/AnimeSearchBar";
import {
  getAnimeRanking,
  type MalRankingType,
} from "@/api/mal";

export const revalidate = 300;

type AnimeLatestPageProps = {
  searchParams: Promise<{
    page?: string;
    ranking?: string;
  }>;
};

const RANKING_INFO: Record<
  MalRankingType,
  {
    title: string;
    description: string;
  }
> = {
  all: {
    title: "Highest Rated Anime",
    description:
      "Browse the highest-rated anime from MyAnimeList.",
  },

  airing: {
    title: "Latest Anime",
    description:
      "Browse currently airing anime from MyAnimeList.",
  },

  upcoming: {
    title: "Upcoming Anime",
    description:
      "Browse upcoming anime from MyAnimeList.",
  },

  tv: {
    title: "Top TV Anime",
    description:
      "Browse the top-ranked TV anime from MyAnimeList.",
  },

  movie: {
    title: "Top Anime Movies",
    description:
      "Browse the top-ranked anime movies from MyAnimeList.",
  },

  ova: {
    title: "Top OVA Anime",
    description:
      "Browse the top-ranked OVA anime from MyAnimeList.",
  },

  ona: {
    title: "Top ONA Anime",
    description:
      "Browse the top-ranked ONA anime from MyAnimeList.",
  },

  special: {
    title: "Top Special Anime",
    description:
      "Browse the top-ranked special anime from MyAnimeList.",
  },

  bypopularity: {
    title: "Most Popular Anime",
    description:
      "Browse the most popular anime from MyAnimeList.",
  },

  favorite: {
    title: "Most Favorited Anime",
    description:
      "Browse the most favorited anime from MyAnimeList.",
  },
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

  const ranking =
    (
      query.ranking as
        | MalRankingType
        | undefined
    ) ?? "airing";

  const rankingType: MalRankingType =
    ranking in RANKING_INFO
      ? ranking
      : "airing";

  const info =
    RANKING_INFO[
      rankingType
    ];

  const data =
    await getAnimeRanking(
      rankingType,
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
              {info.title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-white/55 md:text-base">
              {info.description}
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
            href={`/anime/latest?ranking=${rankingType}&page=${page - 1}`}
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
            href={`/anime/latest?ranking=${rankingType}&page=${page + 1}`}
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
