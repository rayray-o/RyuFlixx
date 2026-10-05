import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAnimeSeries,
  getAnimeTitle,
} from "@/api/anikoto";
import { Params } from "@/types";

const BASE_URL =
  "https://ryuflix.vercel.app";

type AnimeDetailPageProps =
  Params<{
    id: string;
  }>;

export const revalidate = 300;

function cleanDescription(
  description?: string | null,
): string {
  return (
    description
      ?.replace(/<[^>]*>/g, "")
      .trim() ||
    "Anime on RyuFlix."
  );
}

export async function generateMetadata(
  {
    params,
  }: AnimeDetailPageProps,
): Promise<Metadata> {
  const { id } =
    await params;

  try {
    const data =
      await getAnimeSeries(id);

    const anime =
      data.anime;

    const title =
      getAnimeTitle(anime);

    const description =
      cleanDescription(
        anime.description,
      );

    const canonical =
      `${BASE_URL}/anime/${anime.id}`;

    const image =
      anime.poster ||
      anime.image ||
      anime.cover ||
      undefined;

    return {
      title:
        `Watch ${title} | RyuFlix`,

      description,

      alternates: {
        canonical,
      },

      robots: {
        index: true,
        follow: true,
      },

      openGraph: {
        type: "website",
        url: canonical,
        siteName: "RyuFlix",
        title:
          `Watch ${title} | RyuFlix`,
        description,

        ...(image
          ? {
              images: [
                {
                  url: image,
                  alt: title,
                },
              ],
            }
          : {}),
      },

      twitter: {
        card: image
          ? "summary_large_image"
          : "summary",

        title:
          `Watch ${title} | RyuFlix`,
        description,

        ...(image
          ? {
              images: [image],
            }
          : {}),
      },
    };
  } catch {
    return {
      title:
        "Anime | RyuFlix",
    };
  }
}

export default async function AnimeDetailPage(
  {
    params,
  }: AnimeDetailPageProps,
) {
  const { id } =
    await params;

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

  const title =
    getAnimeTitle(anime);

  const description =
    cleanDescription(
      anime.description,
    );

  const image =
    anime.poster ||
    anime.image ||
    anime.cover ||
    null;

  const episodes =
    data.episodes || [];

  const canonical =
    `${BASE_URL}/anime/${anime.id}`;

  const animeSchema = {
    "@context":
      "https://schema.org",

    "@type":
      "TVSeries",

    "@id":
      `${canonical}#anime`,

    url: canonical,

    name: title,

    ...(image
      ? {
          image,
        }
      : {}),

    ...(description
      ? {
          description,
        }
      : {}),

    ...(anime.year
      ? {
          dateCreated:
            `${anime.year}-01-01`,
        }
      : {}),

    ...(anime.genres?.length
      ? {
          genre:
            anime.genres,
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            JSON.stringify(
              animeSchema,
            ).replace(
              /</g,
              "\\u003c",
            ),
        }}
      />

      <main className="mx-auto w-full max-w-6xl px-4 pb-12">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {image && (
            <div className="absolute inset-0">
              <img
                src={image}
                alt=""
                className="h-full w-full object-cover opacity-20 blur-[2px]"
              />

              <div className="absolute inset-0 bg-black/75" />
            </div>
          )}

          <div className="relative flex flex-col gap-6 p-5 md:flex-row md:p-8">
            {image && (
              <div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl md:w-52">
                <img
                  src={image}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="flex min-w-0 flex-col justify-end">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-warning">
                RyuFlix Anime
              </p>

              <h1 className="text-3xl font-bold text-white md:text-5xl">
                {title}
              </h1>

              {anime.native &&
                anime.native !==
                  title && (
                  <p className="mt-2 text-sm text-white/45">
                    {anime.native}
                  </p>
                )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                {anime.year && (
                  <span>
                    {anime.year}
                  </span>
                )}

                {anime.type && (
                  <span>
                    {anime.type}
                  </span>
                )}

                {anime.episodes && (
                  <span>
                    {anime.episodes} episodes
                  </span>
                )}

                {anime.status && (
                  <span>
                    {anime.status}
                  </span>
                )}

                {anime.rating && (
                  <span>
                    {anime.rating}
                  </span>
                )}
              </div>

              {anime.genres &&
                anime.genres.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {anime.genres.map(
                      (genre) => (
                        <span
                          key={genre}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60"
                        >
                          {genre}
                        </span>
                      ),
                    )}
                  </div>
                )}

              <p className="mt-5 max-w-3xl text-sm leading-7 text-white/65">
                {description}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-warning">
                Episodes
              </p>

              <h2 className="mt-1 text-2xl font-bold text-white">
                Watch Episodes
              </h2>
            </div>

            <span className="text-sm text-white/40">
              {episodes.length} available
            </span>
          </div>

          {episodes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {episodes.map(
                (episode) => (
                  <Link
                    key={episode.episode}
                    href={`/anime/${anime.id}/watch?episode=${episode.episode}`}
                    className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-warning/40 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg font-bold text-white">
                        {episode.episode}
                      </span>

                      <span className="text-xs text-warning opacity-0 transition-opacity group-hover:opacity-100">
                        Watch
                      </span>
                    </div>

                    {episode.title && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45">
                        {episode.title}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      {episode.embed_url?.sub && (
                        <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white/45">
                          Sub
                        </span>
                      )}

                      {episode.embed_url?.dub && (
                        <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white/45">
                          Dub
                        </span>
                      )}
                    </div>
                  </Link>
                ),
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/40">
              No episodes available.
            </div>
          )}
        </section>
      </main>
    </>
  );
}
