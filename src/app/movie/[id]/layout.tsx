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
      `Discover ${title} on RyuFlix. Explore information, artwork, genres, release details and more.`;

    const poster = movie.poster_path
      ? `https://image.tmdb.org/t/p/w1280${movie.poster_path}`
      : undefined;

    const url = `${BASE_URL}/movie/${id}`;

    /*
     * Build useful search terms from information
     * that actually belongs to this movie.
     */
    const keywords = [
      title,
      `${title} movie`,
      `${title} film`,
      "RyuFlix",
      ...(movie.release_date
        ? [movie.release_date.slice(0, 4)]
        : []),
      ...(movie.genres?.map(
        (genre) => genre.name
      ) || []),
    ];

    return {
      title: `${title} | RyuFlix`,

      description,

      keywords,

      authors: [
        {
          name: "RyuFlix",
        },
      ],

      creator: "RyuFlix",
      publisher: "RyuFlix",

      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      },

      alternates: {
        canonical: url,
      },

      openGraph: {
        title: `${title} | RyuFlix`,
        description,
        url,
        siteName: "RyuFlix",
        type: "video.movie",

        ...(poster && {
          images: [
            {
              url: poster,
              width: 1280,
              alt: `${title} poster`,
            },
          ],
        }),
      },

      twitter: {
        card: poster
          ? "summary_large_image"
          : "summary",

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
      description:
        "Discover movies and explore their information on RyuFlix.",

      robots: {
        index: true,
        follow: true,
      },
    };
  }
}

export default function MovieLayout({
  children,
}: Props) {
  return children;
            }
