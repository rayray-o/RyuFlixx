import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  getAnime,
  getAnimeImage,
  getAnimeTitle,
} from "@/api/mal";

import { getAniListAnimeByMalId } from "@/api/anilist";

import { Params } from "@/types";

import AnimePlayer from "@/components/anime/AnimePlayer";
import NextEpisodeCountdown from "@/components/anime/NextEpisodeCountdown";

import { isAnimeUpcoming } from "@/utils/animeAiring";

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

  /*
   * AniList is already part of the existing anime
   * architecture and provides:
   *
   * - episode count
   * - upcoming/airing state
   * - next episode
   * - next episode airing timestamp
   *
   * MAL remains the fallback for episode count.
   */
  const aniList =
    await getAniListAnimeByMalId(
      anime.id,
    );

  /*
   * Never allow the watch page to play an anime
   * that has not started airing yet.
   *
   * This also protects against manually entering
   * an /anime/:id/watch URL for an upcoming title.
   */
  const isUpcoming =
    isAnimeUpcoming(
      anime,
      aniList,
    );

  if (isUpcoming) {
    notFound();
  }

  /*
   * Resolve episode count.
   *
   * IMPORTANT:
   * Keep AniList as the primary source here because
   * this is the path that fixed the previous
   * "Episode information is not available" issue.
   */
  const aniListEpisodeCount =
    Number(aniList?.episodes);

  const malEpisodeCount =
    Number(anime.num_episodes);

  const episodeCount =
    Number.isFinite(
      aniListEpisodeCount,
    ) &&
    aniListEpisodeCount > 0
      ? Math.floor(
          aniListEpisodeCount,
        )
      : Number.isFinite(
          malEpisodeCount,
        ) &&
        malEpisodeCount > 0
        ? Math.floor(
            malEpisodeCount,
          )
        : 0;

  /*
   * If the requested episode is greater than the
   * known episode count, don't allow an invalid URL.
   *
   * We only perform this validation when a count exists.
   */
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

  const episodes =
    episodeCount > 0
      ? Array.from(
          {
            length: episodeCount,
          },
          (_, index) =>
            index + 1,
        )
      : [];

  const backdrop =
    anime.background ||
    image;

  const nextAiringEpisode =
    aniList?.nextAiringEpisode;

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
            poster={image}
            image={image}
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
              {requestedLanguage === "dub"
                ? "English Dub"
                : "English Sub"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/anime/${anime.id}/watch?episode=${episodeNumber}&lang=sub`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                requestedLanguage === "sub"
                  ? "border-warning/50 bg-warning/10 text-warning"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              SUB
            </Link>

            <Link
              href={`/anime/${anime.id}/watch?episode=${episodeNumber}&lang=dub`}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                requestedLanguage === "dub"
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

      {nextAiringEpisode?.airingAt &&
        nextAiringEpisode?.episode && (
          <NextEpisodeCountdown
            airingAt={
              nextAiringEpisode.airingAt
            }
            episode={
              nextAiringEpisode.episode
            }
          />
        )}

      {episodeCount > 0 && (
        <section className="relative mt-7 overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="absolute inset-0">
            {backdrop && (
              <img
                src={backdrop}
                alt=""
                aria-hidden="true"
                className="h-full w-full scale-105 object-cover opacity-25 blur-[2px] grayscale"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/75" />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/85" />
          </div>

          <div className="relative p-4 sm:p-5 md:p-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-warning/80">
                  Watch
                </p>

                <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                  Episodes
                </h2>
              </div>

              <p className="text-xs font-medium text-white/40 sm:text-sm">
                {episodeNumber} / {episodeCount}
              </p>
            </div>

            <div className="max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                {episodes.map(
                  (episode) => {
                    const active =
                      episode ===
                      episodeNumber;

                    return (
                      <Link
                        key={episode}
                        href={`/anime/${anime.id}/watch?episode=${episode}&lang=${requestedLanguage}`}
                        aria-current={
                          active
                            ? "page"
                            : undefined
                        }
                        className={`group relative flex h-11 items-center justify-center overflow-hidden rounded-lg border text-sm font-semibold transition-all duration-200 ${
                          active
                            ? "border-warning/60 bg-warning/15 text-warning shadow-[0_0_20px_rgba(255,130,190,0.12)]"
                            : "border-white/10 bg-black/40 text-white/55 hover:border-warning/30 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="relative z-10">
                          {episode}
                        </span>

                        <span
                          className={`absolute inset-x-0 bottom-0 h-px origin-left transition-transform duration-200 ${
                            active
                              ? "scale-x-100 bg-warning"
                              : "scale-x-0 bg-warning/60 group-hover:scale-x-100"
                          }`}
                        />
                      </Link>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {episodeCount === 0 && (
        <section className="relative mt-7 overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="absolute inset-0">
            {backdrop && (
              <img
                src={backdrop}
                alt=""
                aria-hidden="true"
                className="h-full w-full scale-105 object-cover opacity-20 blur-[3px] grayscale"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80" />
          </div>

          <div className="relative px-5 py-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-warning/70">
              Episodes
            </p>

            <p className="mt-2 text-sm text-white/45">
              Episode information is not available for this anime.
            </p>
          </div>
        </section>
      )}
    </main>
  );
      }
