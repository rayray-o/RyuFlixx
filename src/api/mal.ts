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
      response.data ?? [],

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
