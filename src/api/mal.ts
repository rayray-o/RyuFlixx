import type {
  MalAnime,
  MalAnimeDetailResponse,
  MalAnimeResponse,
} from "@/types/mal";

const MAL_API_BASE =
  "https://api.myanimelist.net/v2";

const MAL_FIELDS = [
  "id",
  "title",
  "main_picture",
  "alternative_titles",
  "media_type",
  "status",
  "num_episodes",
  "start_date",
  "end_date",
  "synopsis",
  "mean",
  "genres",
  "rank",
  "popularity",
].join(",");

export type MalRankingType =
  | "all"
  | "airing"
  | "upcoming"
  | "tv"
  | "movie"
  | "ova"
  | "ona"
  | "special"
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

async function getAnimeRanking(
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
    MAL_FIELDS,
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
    MAL_FIELDS,
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

  const response =
    await malRequest<MalAnimeDetailResponse>(
      `/anime/${encodeURIComponent(
        String(id),
      )}?${params.toString()}`,
    );

  return response;
}

export async function getLatestAnime(
  page = 1,
  limit = 24,
): Promise<{
  anime: MalAnime[];
  hasNext: boolean;
}> {
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

export async function getTopOvaAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "ova",
    page,
    limit,
  );
}

export async function getTopOnaAnime(
  page = 1,
  limit = 24,
) {
  return getAnimeRanking(
    "ona",
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
