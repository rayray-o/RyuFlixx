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
    const tv = await tmdb.tvShows.details(Number(id));

    const title = tv.name || "TV Show";
    const description =
      tv.overview ||
      `Discover ${title} and more information on RyuFlix.`;

    const poster = tv.poster_path
      ? `https://image.tmdb.org/t/p/w780${tv.poster_path}`
      : undefined;

    const url = `${BASE_URL}/tv/${id}`;

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
        type: "video.tv_show",
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
      title: "TV Show | RyuFlix",
      description: "Discover TV shows on RyuFlix.",
    };
  }
}

export default function TVLayout({ children }: Props) {
  return children;
}
