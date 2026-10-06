import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAnime,
  getAnimeImage,
  getAnimeTitle,
} from "@/api/mal";
import { Params } from "@/types";
import AnimePlayer from "@/components/anime/AnimePlayer";

const BASE_URL =
  "https://ryuflix.vercel.app";

const MEGAPLAY_BASE =
  "https://megaplay.buzz/stream/mal";

type AnimeWatchPageProps =
  Params<{
    id: string;
  }> & {
    searchParams: Promise<{
      episode?: string;
      lang?: string;
    }>;
  };

export const revalidate = 300;

function getEpisodeNumber(
  value: string | undefined,
): number {
  const parsed =
    Number(value);

  if (
    Number.isFinite(parsed) &&
    parsed > 0
  ) {
    return Math.floor(parsed);
  }

  return 1;
}

function getMegaPlayUrl(
  animeId: string,
  episode: number,
  language: "sub" | "dub",
): string {
  return `${MEGAPLAY_BASE}/${encodeURIComponent(
    animeId,
  )}/${episode}/${language}`;
}

export async function generateMetadata(
  {
    params,
    searchParams,
  }: AnimeWatchPageProps,
): Promise<Metadata> {
  const { id } =
    await params;

  const query =
    await searchParams;

  const episode =
    getEpisodeNumber(
      query.episode,
    );

  try {
    const anime =
      await getAnime(id);

    const title =
      getAnimeTitle(anime);

    return {
      title:
        `${title} Episode ${episode} | RyuFlix`,

      description:
        `Watch ${title} episode ${episode} on RyuFlix.`,

      alternates: {
        canonical:
          `${BASE_URL}/anime/${anime.id}/watch?episode=${episode}`,
      },

      robots: {
        index: false,
        follow: true,
      },
    };
  } catch {
    return {
      title:
        "Anime Player | RyuFlix",
    };
  }
}

export default async function AnimeWatchPage(
  {
    params,
    searchParams,
  }: AnimeWatchPageProps,
) {
  const { id } =
    await params;

  const query =
    await searchParams;

  const episodeNumber =
    getEpisodeNumber(
      query.episode,
    );

  const requestedLanguage =
    query.lang === "dub"
      ? "dub"
      : "sub";

  let anime;

  try {
    anime =
      await getAnime(id);
  } catch {
    notFound();
  }

  if (!anime) {
    notFound();
  }

  const title =
    getAnimeTitle(anime);

  const image =
    getAnimeImage(anime);

  const episodeCount =
    anime.num_episodes &&
    anime.num_episodes > 0
      ? anime.num_episodes
      : 0;

  if (
    episodeCount > 0 &&
    episodeNumber > episodeCount
  ) {
    notFound();
  }

  const playerUrl =
    getMegaPlayUrl(
      String(anime.id),
      episodeNumber,
      requestedLanguage,
    );

  const previousEpisode =
    episodeNumber > 1
      ? episodeNumber - 1
      : null;

  const nextEpisode =
    episodeCount > 0 &&
    episodeNumber < episodeCount
      ? episodeNumber + 1
      : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12">
      <div className="mb-5">
        <Link
          href={`/anime/${anime.id}`}
          className="text-sm text-white/45 transition-colors hover:text-white"
        >
          ← Back to {title}
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="relative aspect-video w-full bg-black">
          <AnimePlayer
            playerUrl={playerUrl}
            animeId={String(anime.id)}
            title={title}
            episode={episodeNumber}
            episodeTitle={`Episode ${episodeNumber}`}
            poster={
              image
            }
            image={
              image
            }
          />
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-warning">
              {title}
            </p>

            <h1 className="mt-1 text-2xl font-bold text-white">
              Episode {episodeNumber}
            </h1>

            <p className="mt-1 text-sm text-white/45">
              {requestedLanguage ===
              "dub"
                ? "English Dub"
                : "English Sub"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/anime/${anime.id}/watch?episode=${episodeNumber}&lang=sub`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                requestedLanguage ===
                "sub"
                  ? "border-warning/50 bg-warning/10 text-warning"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              SUB
            </Link>

            <Link
              href={`/anime/${anime.id}/watch?episode=${episodeNumber}&lang=dub`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                requestedLanguage ===
                "dub"
                  ? "border-warning/50 bg-warning/10 text-warning"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              DUB
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            {previousEpisode ? (
              <Link
                href={`/anime/${anime.id}/watch?episode=${previousEpisode}&lang=${requestedLanguage}`}
                className="inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                ← Previous
              </Link>
            ) : (
              <span className="text-sm text-white/20">
                ← Previous
              </span>
            )}
          </div>

          <Link
            href={`/anime/${anime.id}`}
            className="text-sm text-white/40 transition-colors hover:text-white"
          >
            All Episodes
          </Link>

          <div>
            {nextEpisode ? (
              <Link
                href={`/anime/${anime.id}/watch?episode=${nextEpisode}&lang=${requestedLanguage}`}
                className="inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                Next →
              </Link>
            ) : (
              <span className="text-sm text-white/20">
                Next →
              </span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
    }
