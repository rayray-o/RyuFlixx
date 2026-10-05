import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tmdb } from "@/api/tmdb";
import { Params } from "@/types";
import TVShowDetailClient from "./TVShowDetailClient";

const BASE_URL = "https://ryuflix.vercel.app";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

async function getTVShow(id: number) {
  return tmdb.tvShows.details(id, [
    "images",
    "videos",
    "credits",
    "keywords",
    "recommendations",
    "similar",
    "reviews",
    "watch/providers",
  ]);
}

export async function generateMetadata(
  { params }: Params<{ id: string }>,
): Promise<Metadata> {
  const { id } = await params;
  const tvId = Number(id);

  if (!Number.isInteger(tvId)) {
    return {
      title: "TV Show Not Found | RyuFlix",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  try {
    const tv = await getTVShow(tvId);

    const title =
      tv.name?.trim() || "TV Show";

    const year =
      tv.first_air_date?.slice(0, 4);

    const pageTitle = year
      ? `Watch ${title} (${year}) | RyuFlix`
      : `Watch ${title} | RyuFlix`;

    const description =
      tv.overview?.trim() ||
      `Watch ${title} on RyuFlix.`;

    const canonical =
      `${BASE_URL}/tv/${tvId}`;

    const image = tv.poster_path
      ? `${TMDB_IMAGE_BASE}/w780${tv.poster_path}`
      : tv.backdrop_path
        ? `${TMDB_IMAGE_BASE}/w1280${tv.backdrop_path}`
        : undefined;

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
                  width: 780,
                  height: 1170,
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
      title: "TV Show | RyuFlix",
    };
  }
}

export default async function TVShowDetailPage(
  { params }: Params<{ id: string }>,
) {
  const { id } = await params;
  const tvId = Number(id);

  if (!Number.isInteger(tvId)) {
    notFound();
  }

  let tv;

  try {
    tv = await getTVShow(tvId);
  } catch {
    notFound();
  }

  const canonical =
    `${BASE_URL}/tv/${tvId}`;

  const image = tv.poster_path
    ? `${TMDB_IMAGE_BASE}/w780${tv.poster_path}`
    : tv.backdrop_path
      ? `${TMDB_IMAGE_BASE}/w1280${tv.backdrop_path}`
      : null;

  const creators =
    tv.created_by?.map((person) => ({
      "@type": "Person",
      name: person.name,
    })) ?? [];

  const actors = tv.credits.cast
    .slice(0, 10)
    .map((person) => ({
      "@type": "Person",
      name: person.name,
    }));

  const tvSchema = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "@id": `${canonical}#tvseries`,
    url: canonical,
    name: tv.name,
    ...(image
      ? {
          image: image,
        }
      : {}),
    ...(tv.first_air_date
      ? {
          dateCreated: tv.first_air_date,
        }
      : {}),
    ...(tv.overview
      ? {
          description: tv.overview,
        }
      : {}),
    ...(tv.genres?.length
      ? {
          genre: tv.genres.map(
            (genre) => genre.name,
          ),
        }
      : {}),
    ...(creators.length
      ? {
          creator: creators,
        }
      : {}),
    ...(actors.length
      ? {
          actor: actors,
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            tvSchema,
          ).replace(/</g, "\\u003c"),
        }}
      />

      <TVShowDetailClient tv={tv} />
    </>
  );
                        }
