import type {
  MalAnime,
  MalAnimeDetailResponse,
  MalAnimeResponse,
} from "@/types/mal";

const MAL_API_BASE =
  "https://api.myanimelist.net/v2";

const JIKAN_API_BASE =
  "https://api.jikan.moe/v4";

const MAL_FIELDS = [
  "id",
  "title",
  "main_picture",
  "alternative_titles",
  "start_date",
  "end_date",
  "synopsis",
  "mean",
  "rank",
  "popularity",
  "media_type",
  "status",
  "genres",
  "num_episodes",
  "start_season",
  "broadcast",
  "source",
  "average_episode_duration",
  "rating",
  "studios",
  "pictures",
  "background",
  "related_anime",
  "recommendations",
  "statistics",
].join(",");

export type MalRankingType =
  | "all"
  | "airing"
  | "upcoming"
  | "tv"
  | "movie"
  | "bypopularity"
  | "favorite";

function getMalClientId(): string {
  const clientId =
    process.env.MAL_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "MAL_CLIENT_ID is not configured",
    );
  }

  return clientId;
}

async function malRequest<T>(
  path: string,
): Promise<T> {
  const response =
    await fetch(
      `${MAL_API_BASE}${path}`,
      {
        headers: {
          Accept:
            "application/json",

          "X-MAL-CLIENT-ID":
            getMalClientId(),
        },

        next: {
          revalidate: 300,
        },
      },
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `MAL request failed with ${response.status}: ${body}`,
    );
  }

  return (
    (await response.json()) as T
  );
}

type JikanAnimeResponse = {
  data?: {
    episodes?: number | null;
  } | null;
};

type JikanEpisode = {
  mal_id?: number | null;
  episode?: string | null;
};

type JikanEpisodesResponse = {
  data?: JikanEpisode[];

  pagination?: {
    last_visible_page?: number | null;
    has_next_page?: boolean | null;
  };
};

async function jikanRequest<T>(
  path: string,
): Promise<T> {
  const response =
    await fetch(
      `${JIKAN_API_BASE}${path}`,
      {
        headers: {
          Accept:
            "application/json",
        },

        next: {
          revalidate: 300,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `Jikan request failed with ${response.status}`,
    );
  }

  return (
    (await response.json()) as T
  );
}

/**
 * Returns the number of aired/known episodes for an anime.
 *
 * Primary source:
 *   MyAnimeList API -> num_episodes
 *
 * Fallback:
 *   Jikan's MAL-backed anime metadata
 *
 * Final fallback:
 *   Jikan's paginated MAL episode list.
 *
 * The final fallback is important for long-running anime such as
 * One Piece, where the episode list can contain more than 100
 * episodes and the anime metadata count may be unavailable.
 */
export async function getAnimeEpisodeCount(
  anime: MalAnime,
): Promise<number> {
  const malCount =
    Number(anime.num_episodes);

  if (
    Number.isFinite(malCount) &&
    malCount > 0
  ) {
    return Math.floor(
      malCount,
    );
  }

  const animeId =
    Number(anime.id);

  if (
    !Number.isFinite(animeId) ||
    animeId <= 0
  ) {
    return 0;
  }

  /*
   * First fallback:
   * Ask Jikan for the same MAL anime's main metadata.
   *
   * Jikan documents this endpoint as parsing the MAL anime page.
   */
  try {
    const jikanAnime =
      await jikanRequest<JikanAnimeResponse>(
        `/anime/${animeId}`,
      );

    const jikanCount =
      Number(
        jikanAnime.data?.episodes,
      );

    if (
      Number.isFinite(jikanCount) &&
      jikanCount > 0
    ) {
      return Math.floor(
        jikanCount,
      );
    }
  } catch {
    /*
     * Do not make the whole watch page fail just because
     * the fallback metadata request failed.
     */
  }

  /*
   * Final fallback:
   * Read the actual MAL-backed episode list.
   *
   * Jikan returns episode lists in pages of up to 100.
   * We only need the first page to discover the final page,
   * then request that final page and use its highest episode
   * number.
   */
  try {
    const firstPage =
      await jikanRequest<JikanEpisodesResponse>(
        `/anime/${animeId}/episodes?page=1`,
      );

    const firstEpisodes =
      firstPage.data ?? [];

    let highestEpisode =
      getHighestEpisodeNumber(
        firstEpisodes,
      );

    const lastPage =
      Number(
        firstPage.pagination
          ?.last_visible_page,
      );

    if (
      Number.isFinite(lastPage) &&
      lastPage > 1
    ) {
      const finalPage =
        await jikanRequest<JikanEpisodesResponse>(
          `/anime/${animeId}/episodes?page=${Math.floor(
            lastPage,
          )}`,
        );

      const finalEpisodes =
        finalPage.data ?? [];

      highestEpisode =
        Math.max(
          highestEpisode,
          getHighestEpisodeNumber(
            finalEpisodes,
          ),
        );
    }

    return highestEpisode;
  } catch {
    return 0;
  }
}

function getHighestEpisodeNumber(
  episodes: JikanEpisode[],
): number {
  let highest = 0;

  for (const episode of episodes) {
    const parsed =
      Number(
        episode.mal_id ??
          episode.episode,
      );

    if (
      Number.isFinite(parsed) &&
      parsed > highest
    ) {
      highest =
        Math.floor(parsed);
    }
  }

  return highest;
}

export async function getAnimeRanking(
  rankingType: MalRankingType,
  page = 1,
  limit = 24,
): Promise<{
  anime: MalAnime[];
  hasNext: boolean;
}> {
  const safePage =
    Number.isFinite(page) &&
    page > 0
      ? Math.floor(page)
      : 1;

  const safeLimit =
    Number.isFinite(limit) &&
    limit > 0
      ? Math.floor(limit)
      : 24;

  const offset =
    (safePage - 1) * safeLimit;

  const params =
    new URLSearchParams();

  params.set(
    "ranking_type",
    rankingType,
  );

  params.set(
    "limit",
    String(safeLimit),
  );

  params.set(
    "offset",
    String(offset),
  );

  params.set(
    "fields",
    [
      "id",
      "title",
      "main_picture",
      "alternative_titles",
      "media_type",
      "status",
      "num_episodes",
      "start_date",
      "mean",
      "genres",
    ].join(","),
  );

  const response =
    await malRequest<MalAnimeResponse>(
      `/anime/ranking?${params.toString()}`,
    );

  return {
    anime:
      (response.data ?? [])
        .map(
          (item) =>
            item.node,
        )
        .filter(
          (
            anime,
          ): anime is MalAnime =>
            Boolean(anime),
        ),

    hasNext:
      Boolean(response.paging?.next),
  };
}

export async function searchAnime(
  query: string,
  page = 1,
  limit = 24,
): Promise<{
  anime: MalAnime[];
  hasNext: boolean;
}> {
  const trimmed =
    query.trim();

  if (!trimmed) {
    return {
      anime: [],
      hasNext: false,
    };
  }

  const safePage =
    Number.isFinite(page) &&
    page > 0
      ? Math.floor(page)
      : 1;

  const offset =
    (safePage - 1) * limit;

  const params =
    new URLSearchParams();

  params.set(
    "q",
    trimmed,
  );

  params.set(
    "limit",
    String(limit),
  );

  params.set(
    "offset",
    String(offset),
  );

  params.set(
    "fields",
    [
      "id",
      "title",
      "main_picture",
      "alternative_titles",
      "media_type",
      "status",
      "num_episodes",
      "start_date",
      "mean",
      "genres",
    ].join(","),
  );

  const response =
    await malRequest<MalAnimeResponse>(
      `/anime?${params.toString()}`,
    );

  return {
    anime:
      (response.data ?? [])
        .map(
          (item) =>
            item.node,
        )
        .filter(
          (
            anime,
          ): anime is MalAnime =>
            Boolean(anime),
        ),

    hasNext:
      Boolean(response.paging?.next),
  };
}

export async function getAnime(
  id: string | number,
): Promise<MalAnime> {
  const params =
    new URLSearchParams();

  params.set(
    "fields",
    MAL_FIELDS,
  );

  return malRequest<MalAnimeDetailResponse>(
    `/anime/${encodeURIComponent(
      String(id),
    )}?${params.toString()}`,
  );
}

export async function getLatestAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "airing",
    page,
    limit,
  );
}

export async function getTopAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "all",
    page,
    limit,
  );
}

export async function getAiringAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "airing",
    page,
    limit,
  );
}

export async function getUpcomingAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "upcoming",
    page,
    limit,
  );
}

export async function getPopularAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "bypopularity",
    page,
    limit,
  );
}

export async function getTopTvAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "tv",
    page,
    limit,
  );
}

export async function getTopMovieAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "movie",
    page,
    limit,
  );
}

export async function getFavoriteAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "favorite",
    page,
    limit,
  );
}

export function getAnimeTitle(
  anime: MalAnime,
): string {
  return (
    anime.title ||
    "Unknown Anime"
  );
}

export function getAnimeImage(
  anime: MalAnime,
): string | null {
  return (
    anime.main_picture?.large ??
    anime.main_picture?.medium ??
    null
  );
}

export function getAnimeYear(
  anime: MalAnime,
): number | null {
  if (!anime.start_date) {
    return null;
  }

  const year =
    Number(
      anime.start_date.slice(
        0,
        4,
      ),
    );

  return Number.isFinite(year)
    ? year
    : null;
}

export function getAnimeGenres(
  anime: MalAnime,
): string[] {
  return (
    anime.genres?.map(
      (genre) =>
        genre.name,
    ) ?? []
  );
  }
