import type { Metadata } from "next";
import { tmdb } from "@/api/tmdb";

const BASE_URL = "https://ryuflix.vercel.app";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const movie = await tmdb.movies.details(Number(id));

    const title = movie.title || "Movie";
    const description =
      movie.overview ||
      `Watch ${title} and discover more information on RyuFlix.`;

    const poster = movie.poster_path
      ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
      : undefined;

    const url = `${BASE_URL}/movie/${id}`;

    return {
      title: `${title} | RyuFlix`,
      description,

      alternates: {
        canonical: url,
      },

      openGraph: {
        title: `${title} | RyuFlix`,
        description,
        url,
        type: "video.movie",
        ...(poster && {
          images: [
            {
              url: poster,
              width: 780,
              alt: `${title} poster`,
            },
          ],
        }),
      },

      twitter: {
        card: poster ? "summary_large_image" : "summary",
        title: `${title} | RyuFlix`,
        description,
        ...(poster && {
          images: [poster],
        }),
      },
    };
  } catch {
    return {
      title: "Movie | RyuFlix",
      description: "Discover movies on RyuFlix.",
    };
  }
}

export default function MovieLayout({ children }: Props) {
  return children;
        }
