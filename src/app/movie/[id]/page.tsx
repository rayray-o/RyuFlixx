import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tmdb } from "@/api/tmdb";
import { Params } from "@/types";
import MovieDetailClient from "./MovieDetailClient";

const BASE_URL = "https://ryuflix.vercel.app";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

async function getMovie(id: number) {
  return tmdb.movies.details(id, [
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

function getMovieYear(
  releaseDate?: string | null,
) {
  return releaseDate?.slice(0, 4) || null;
}

export async function generateMetadata(
  { params }: Params<{ id: string }>,
): Promise<Metadata> {
  const { id } = await params;
  const movieId = Number(id);

  if (!Number.isInteger(movieId)) {
    return {
      title: "Movie Not Found | RyuFlix",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  try {
    const movie = await getMovie(movieId);

    const year = getMovieYear(
      movie.release_date,
    );

    const title = movie.title?.trim() || "Movie";

    const pageTitle = year
      ? `Watch ${title} (${year}) | RyuFlix`
      : `Watch ${title} | RyuFlix`;

    const description =
      movie.overview?.trim() ||
      `Watch ${title} on RyuFlix.`;

    const canonical =
      `${BASE_URL}/movie/${movieId}`;

    const image = movie.poster_path
      ? `${TMDB_IMAGE_BASE}/w780${movie.poster_path}`
      : movie.backdrop_path
        ? `${TMDB_IMAGE_BASE}/w1280${movie.backdrop_path}`
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
        type: "video.movie",
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
      title: "Movie | RyuFlix",
    };
  }
}

export default async function MovieDetailPage(
  { params }: Params<{ id: string }>,
) {
  const { id } = await params;
  const movieId = Number(id);

  if (!Number.isInteger(movieId)) {
    notFound();
  }

  let movie;

  try {
    movie = await getMovie(movieId);
  } catch {
    notFound();
  }

  const canonical =
    `${BASE_URL}/movie/${movieId}`;

  const image = movie.poster_path
    ? `${TMDB_IMAGE_BASE}/w780${movie.poster_path}`
    : movie.backdrop_path
      ? `${TMDB_IMAGE_BASE}/w1280${movie.backdrop_path}`
      : null;

  const directors = movie.credits.crew
    .filter(
      (person) =>
        person.job === "Director",
    )
    .map((person) => ({
      "@type": "Person",
      name: person.name,
    }));

  const actors = movie.credits.cast
    .slice(0, 10)
    .map((person) => ({
      "@type": "Person",
      name: person.name,
    }));

  const movieSchema = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "@id": `${canonical}#movie`,
    url: canonical,
    name: movie.title,
    ...(image
      ? {
          image: image,
        }
      : {}),
    ...(movie.release_date
      ? {
          dateCreated: movie.release_date,
        }
      : {}),
    ...(movie.overview
      ? {
          description: movie.overview,
        }
      : {}),
    ...(movie.genres?.length
      ? {
          genre: movie.genres.map(
            (genre) => genre.name,
          ),
        }
      : {}),
    ...(directors.length
      ? {
          director: directors,
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
            movieSchema,
          ).replace(/</g, "\\u003c"),
        }}
      />

      <MovieDetailClient movie={movie} />
    </>
  );
}
