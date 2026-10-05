import type {
  AnikotoAnime,
  AnikotoEpisode,
  AnikotoRecentResponse,
  AnikotoSeriesResponse,
} from "@/types/anikoto";

const ANIKOTO_API_BASE = "https://anikotoapi.site";

async function anikotoRequest<T>(
  path: string,
): Promise<T> {
  const response = await fetch(
    `${ANIKOTO_API_BASE}${path}`,
    {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 300,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Anikoto request failed with ${response.status}`,
    );
  }

  const data = (await response.json()) as T;

  return data;
}

export async function getRecentAnime(
  page = 1,
  perPage = 24,
): Promise<AnikotoRecentResponse> {
  return anikotoRequest<AnikotoRecentResponse>(
    `/recent-anime?page=${page}&per_page=${perPage}`,
  );
}

export async function getAnimeSeries(
  id: string,
): Promise<AnikotoSeriesResponse> {
  return anikotoRequest<AnikotoSeriesResponse>(
    `/series/${encodeURIComponent(id)}`,
  );
}

export function getAnimeTitle(
  anime: AnikotoAnime,
): string {
  return (
    anime.title ||
    anime.name ||
    anime.romaji ||
    "Unknown Anime"
  );
}

export function getEpisodeEmbed(
  episode: AnikotoEpisode,
  language: "sub" | "dub" = "sub",
): string | null {
  return episode.embed_url?.[language] ?? null;
}
