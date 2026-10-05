import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAnimeById,
  getAnimeTitle,
} from "@/api/anilist";
import { Params } from "@/types";
import Link from "next/link";
import Image from "next/image";

const BASE_URL =
  "https://ryuflix.vercel.app";

type AnimeDetailPageProps =
  Params<{
    id: string;
  }>;

export async function generateMetadata(
  {
    params,
  }: AnimeDetailPageProps,
): Promise<Metadata> {
  const { id } =
    await params;

  const animeId =
    Number(id);

  if (
    !Number.isInteger(
      animeId,
    )
  ) {
    return {
      title:
        "Anime Not Found | RyuFlix",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  try {
    const anime =
      await getAnimeById(
        animeId,
      );

    const title =
      getAnimeTitle(anime);

    const pageTitle =
      `Watch ${title} | RyuFlix`;

    const description =
      anime.description
        ?.replace(
          /<[^>]*>/g,
          "",
        )
        .trim() ||
      `Watch ${title} on RyuFlix.`;

    const canonical =
      `${BASE_URL}/anime/${anime.id}`;

    const image =
      anime.coverImage.extraLarge ||
      anime.coverImage.large ||
      anime.bannerImage ||
      undefined;

    return {
      title: pageTitle,

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
        title: pageTitle,
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

        title: pageTitle,
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

  const animeId =
    Number(id);

  if (
    !Number.isInteger(
      animeId,
    )
  ) {
    notFound();
  }

  let anime;

  try {
    anime =
      await getAnimeById(
        animeId,
      );
  } catch {
    notFound();
  }

  const title =
    getAnimeTitle(anime);

  const description =
    anime.description
      ?.replace(
        /<[^>]*>/g,
        "",
      )
      .trim() ||
    "Anime on RyuFlix.";

  const canonical =
    `${BASE_URL}/anime/${anime.id}`;

  const image =
    anime.coverImage.extraLarge ||
    anime.coverImage.large ||
    anime.bannerImage ||
    null;

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

    ...(anime.seasonYear
      ? {
          dateCreated:
            `${anime.seasonYear}-01-01`,
        }
      : {}),

    ...(anime.genres.length
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
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {anime.bannerImage && (
            <div className="absolute inset-0">
              <Image
                src={
                  anime.bannerImage
                }
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover opacity-25 blur-[1px]"
              />

              <div className="absolute inset-0 bg-black/70" />
            </div>
          )}

          <div className="relative flex flex-col gap-6 p-5 md:flex-row md:p-8">
            {image && (
              <div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl md:w-52">
                <Image
                  src={image}
                  alt={title}
                  fill
                  priority
                  sizes="208px"
                  className="object-cover"
                />
              </div>
            )}

            <div className="flex min-w-0 flex-col justify-end">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-warning">
                Anime
              </p>

              <h1 className="text-3xl font-bold text-white md:text-5xl">
                {title}
              </h1>

              {anime.title.native &&
                anime.title.native !==
                  title && (
                  <p className="mt-2 text-sm text-white/45">
                    {anime.title.native}
                  </p>
                )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                {anime.seasonYear && (
                  <span>
                    {anime.seasonYear}
                  </span>
                )}

                {anime.format && (
                  <span>
                    {anime.format}
                  </span>
                )}

                {anime.episodes && (
                  <span>
                    {anime.episodes} episodes
                  </span>
                )}

                {anime.averageScore && (
                  <span>
                    Score{" "}
                    {anime.averageScore / 10}
                  </span>
                )}
              </div>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-white/65">
                {description}
              </p>

              <div className="mt-6">
                <Link
                  href={`/anime/${anime.id}/watch?episode=1`}
                  className="inline-flex items-center rounded-xl bg-warning px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
                >
                  Watch Episode 1
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
            }
