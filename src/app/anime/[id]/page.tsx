import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAnime,
  getAnimeGenres,
  getAnimeImage,
  getAnimeTitle,
} from "@/api/mal";
import {
  getAniListAnimeByMalId,
} from "@/api/anilist";
import AnimeDetailClient from "@/components/anime/AnimeDetailClient";
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
      ?.replace(
        /<[^>]*>/g,
        "",
      )
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

  const aniList =
    await getAniListAnimeByMalId(
      anime.id,
    );

  const title =
    getAnimeTitle(anime);

  const description =
    cleanDescription(
      anime.synopsis,
    );

  const image =
    getAnimeImage(anime);

  const genres =
    getAnimeGenres(anime);

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

      <AnimeDetailClient
        anime={anime}
        aniList={aniList}
      />
    </>
  );
          }
