import type {
  AnikotoAnime,
  AnikotoEpisode,
  AnikotoRecentResponse,
  AnikotoSeriesResponse,
} from "@/types/anikoto";

const ANIKOTO_API_BASE =
  "https://anikotoapi.site";

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

  const data =
    (await response.json()) as T;

  return data;
}

export async function getRecentAnime(
  page = 1,
  perPage = 24,
): Promise<
  AnikotoRecentResponse & {
    anime: AnikotoAnime[];
  }
> {
  const response =
    await anikotoRequest<AnikotoRecentResponse>(
      `/recent-anime?page=${page}&per_page=${perPage}`,
    );

  return {
    ...response,
    anime:
      response.data ?? [],
  };
}

export async function getAnimeSeries(
  id: string,
): Promise<AnikotoSeriesResponse> {
  const response =
    await anikotoRequest<{
      ok: boolean;
      data?: {
        anime?: AnikotoAnime;
        episodes?: Array<{
          number?: number | string;
          episode?: number | string;
          title?: string | null;
          episode_embed_id?:
            | string
            | number
            | null;
          embed_url?: {
            sub?: string | null;
            dub?: string | null;
          } | null;
        }>;
      };
    }>(
      `/series/${encodeURIComponent(id)}`,
    );

  if (
    !response.data?.anime
  ) {
    throw new Error(
      "Anikoto series response did not contain anime data",
    );
  }

  const episodes =
    (response.data.episodes ?? [])
      .map((episode) => {
        const number =
          Number(
            episode.number ??
              episode.episode,
          );

        return {
          episode: number,
          title:
            episode.title ??
            null,
          episode_embed_id:
            episode.episode_embed_id ??
            null,
          embed_url:
            episode.embed_url ??
            null,
        };
      })
      .filter(
        (episode) =>
          Number.isFinite(
            episode.episode,
          ),
      )
      .sort(
        (a, b) =>
          a.episode -
          b.episode,
      );

  return {
    ok: response.ok,
    anime:
      response.data.anime,
    episodes,
  };
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
  language:
    | "sub"
    | "dub" = "sub",
): string | null {
  return (
    episode.embed_url?.[
      language
    ] ?? null
  );
          }
