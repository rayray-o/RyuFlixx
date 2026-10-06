import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAnime,
  getAnimeImage,
  getAnimeTitle,
} from "@/api/mal";
import {
  getAnimeEpisodes,
  type MalEpisode,
} from "@/api/mal-episodes";
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

function getEpisodeTitle(
  episode: MalEpisode | undefined,
  number: number,
): string {
  const title =
    episode?.title?.trim();

  return title ||
    `Episode ${number}`;
}

function EpisodeCard({
  animeId,
  episode,
  activeEpisode,
  language,
  title,
}: {
  animeId: string;
  episode: MalEpisode;
  activeEpisode: number;
  language: "sub" | "dub";
  title: string;
}) {
  const isActive =
    episode.mal_id ===
    activeEpisode;

  const episodeTitle =
    getEpisodeTitle(
      episode,
      episode.mal_id,
    );

  return (
    <Link
      href={`/anime/${animeId}/watch?episode=${episode.mal_id}&lang=${language}`}
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isActive
          ? "border-warning/50 bg-warning/10 shadow-[0_0_30px_rgba(244,114,182,0.08)]"
          : "border-white/[0.08] bg-black/35 hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      <div className="relative flex min-h-[68px] items-center gap-3 px-3 py-2.5">
        <div
          className={`flex h-9 min-w-9 items-center justify-center rounded-lg text-xs font-bold ${
            isActive
              ? "bg-warning text-black"
              : "bg-white/[0.07] text-white/55 group-hover:bg-white/10 group-hover:text-white"
          }`}
        >
          {episode.mal_id}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-semibold ${
              isActive
                ? "text-warning"
                : "text-white/85 group-hover:text-white"
            }`}
          >
            {episodeTitle}
          </p>

          <div className="mt-1 flex items-center gap-2">
            {episode.filler ? (
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Filler
              </span>
            ) : null}

            {episode.recap ? (
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Recap
              </span>
            ) : null}

            {!episode.filler &&
            !episode.recap ? (
              <span className="text-[10px] text-white/25">
                {title}
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={`text-lg transition-transform duration-300 ${
            isActive
              ? "text-warning"
              : "text-white/15 group-hover:translate-x-0.5 group-hover:text-white/45"
          }`}
        >
          →
        </span>
      </div>
    </Link>
  );
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

  const episodes =
    await getAnimeEpisodes(
      anime.id,
    );

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

  const actualEpisode =
    episodes.find(
      (episode) =>
        episode.mal_id ===
        episodeNumber,
    );

  const currentEpisodeTitle =
    getEpisodeTitle(
      actualEpisode,
      episodeNumber,
    );

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
            episodeTitle={
              currentEpisodeTitle
            }
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

            <p className="mt-1 truncate text-sm text-white/45">
              {currentEpisodeTitle}
            </p>

            <p className="mt-1 text-xs text-white/30">
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

          <span className="text-sm text-white/40">
            {episodeCount > 0
              ? `${episodeCount} Episodes`
              : "Episodes"}
          </span>

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

      {episodes.length > 0 ? (
        <section className="relative mt-8 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#090909]">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.16] grayscale"
            style={{
              backgroundImage: image
                ? `url("${image}")`
                : undefined,
            }}
          />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%),linear-gradient(to_bottom,rgba(5,5,5,0.72),rgba(5,5,5,0.96)_45%,#050505)]" />

          <div className="relative p-4 sm:p-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-warning/70">
                  Episode Guide
                </p>

                <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                  All Episodes
                </h2>
              </div>

              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/40">
                {episodes.length}
              </span>
            </div>

            <div className="max-h-[520px] overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {episodes.map(
                  (episode) => (
                    <EpisodeCard
                      key={
                        episode.mal_id
                      }
                      animeId={String(
                        anime.id,
                      )}
                      episode={
                        episode
                      }
                      activeEpisode={
                        episodeNumber
                      }
                      language={
                        requestedLanguage
                      }
                      title={title}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
          }
