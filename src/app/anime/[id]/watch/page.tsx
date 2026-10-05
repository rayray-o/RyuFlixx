import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAnimeSeries,
  getAnimeTitle,
  getEpisodeEmbed,
} from "@/api/anikoto";
import { Params } from "@/types";

const BASE_URL =
  "https://ryuflix.vercel.app";

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
  const parsed = Number(value);

  if (
    Number.isFinite(parsed) &&
    parsed > 0
  ) {
    return parsed;
  }

  return 1;
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
    const data =
      await getAnimeSeries(id);

    const anime =
      data.anime;

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

  let data;

  try {
    data =
      await getAnimeSeries(id);
  } catch {
    notFound();
  }

  const anime =
    data.anime;

  if (!anime) {
    notFound();
  }

  const episodes =
    data.episodes ?? [];

  const episode =
    episodes.find(
      (item) =>
        item.episode ===
        episodeNumber,
    );

  if (!episode) {
    notFound();
  }

  const title =
    getAnimeTitle(anime);

  const embed =
    getEpisodeEmbed(
      episode,
      requestedLanguage,
    );

  const fallbackEmbedId =
    episode.episode_embed_id;

  const fallbackUrl =
    fallbackEmbedId
      ? `https://megaplay.buzz/stream/s-2/${encodeURIComponent(
          String(fallbackEmbedId),
        )}/${requestedLanguage}`
      : null;

  const playerUrl =
    embed ||
    fallbackUrl;

  if (!playerUrl) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-warning">
            RyuFlix Anime
          </p>

          <h1 className="mt-3 text-2xl font-bold text-white">
            Episode unavailable
          </h1>

          <p className="mt-2 text-sm text-white/45">
            This episode does not currently have
            a playable embed.
          </p>

          <Link
            href={`/anime/${anime.id}`}
            className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            Back to episodes
          </Link>
        </div>
      </main>
    );
  }

  const previousEpisode =
    episodes.find(
      (item) =>
        item.episode ===
        episodeNumber - 1,
    );

  const nextEpisode =
    episodes.find(
      (item) =>
        item.episode ===
        episodeNumber + 1,
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
          <iframe
            key={playerUrl}
            src={playerUrl}
            title={`${title} Episode ${episodeNumber}`}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
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

            {episode.title && (
              <p className="mt-1 text-sm text-white/45">
                {episode.title}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {episode.embed_url?.sub && (
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
            )}

            {episode.embed_url?.dub && (
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
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            {previousEpisode ? (
              <Link
                href={`/anime/${anime.id}/watch?episode=${previousEpisode.episode}&lang=${requestedLanguage}`}
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
                href={`/anime/${anime.id}/watch?episode=${nextEpisode.episode}&lang=${requestedLanguage}`}
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
