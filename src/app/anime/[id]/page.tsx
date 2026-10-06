import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAnime,
  getAnimeGenres,
  getAnimeImage,
  getAnimeTitle,
  getAnimeYear,
} from "@/api/mal";
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
    const anime =
      await getAnime(id);

    const title =
      getAnimeTitle(anime);

    const description =
      cleanDescription(
        anime.synopsis,
      );

    const canonical =
      `${BASE_URL}/anime/${anime.id}`;

    const image =
      getAnimeImage(anime) ??
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

  const description =
    cleanDescription(
      anime.synopsis,
    );

  const image =
    getAnimeImage(anime);

  const year =
    getAnimeYear(anime);

  const genres =
    getAnimeGenres(anime);

  const episodeCount =
    anime.num_episodes &&
    anime.num_episodes > 0
      ? anime.num_episodes
      : 0;

  const episodes =
    Array.from(
      {
        length:
          episodeCount,
      },
      (_, index) =>
        index + 1,
    );

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

    ...(year
      ? {
          dateCreated:
            `${year}-01-01`,
        }
      : {}),

    ...(genres.length
      ? {
          genre: genres,
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

              {anime.alternative_titles?.ja &&
                anime.alternative_titles.ja !==
                  title && (
                  <p className="mt-2 text-sm text-white/45">
                    {anime.alternative_titles.ja}
                  </p>
                )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                {year && (
                  <span>
                    {year}
                  </span>
                )}

                {anime.media_type && (
                  <span>
                    {anime.media_type}
                  </span>
                )}

                {episodeCount > 0 && (
                  <span>
                    {episodeCount} episodes
                  </span>
                )}

                {anime.status && (
                  <span>
                    {anime.status}
                  </span>
                )}

                {anime.mean != null && (
                  <span>
                    MAL {anime.mean}
                  </span>
                )}
              </div>

              {genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {genres.map(
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
              {episodeCount > 0
                ? `${episodeCount} available`
                : "Episode count unavailable"}
            </span>
          </div>

          {episodes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {episodes.map(
                (episode) => (
                  <Link
                    key={episode}
                    href={`/anime/${anime.id}/watch?episode=${episode}`}
                    className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-warning/40 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg font-bold text-white">
                        {episode}
                      </span>

                      <span className="text-xs text-warning opacity-0 transition-opacity group-hover:opacity-100">
                        Watch
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-white/45">
                      Episode {episode}
                    </p>

                    <div className="mt-3">
                      <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white/45">
                        SUB / DUB
                      </span>
                    </div>
                  </Link>
                ),
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/40">
              MAL does not currently provide an episode count for this anime.
            </div>
          )}
        </section>
      </main>
    </>
  );
        }
