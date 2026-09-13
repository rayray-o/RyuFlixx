const SIMKL_API_BASE = "https://api.simkl.com";

const SIMKL_CLIENT_ID = process.env.SIMKL_CLIENT_ID;
const SIMKL_APP_NAME =
  process.env.SIMKL_APP_NAME || "RyuFlix";
const SIMKL_APP_VERSION =
  process.env.SIMKL_APP_VERSION || "1.0";

const SIMKL_USER_AGENT =
  `RyuFlix/${SIMKL_APP_VERSION}`;

export type SimklMediaType =
  | "movies"
  | "shows"
  | "anime";

export type SimklActivity = {
  movies?: string;
  shows?: string;
  anime?: string;
  [key: string]: unknown;
};

export type SimklSyncItem = {
  title?: string;
  year?: number;
  watched_at?: string;
  last_watched_at?: string;
  user_rating?: number;
  rating?: number;
  status?: string;
  watched?: boolean;

  ids?: {
    simkl?: number;
    tmdb?: number | string;
    imdb?: string;
    tvdb?: number | string;
    mal?: number | string;
    [key: string]: unknown;
  };

  [key: string]: unknown;
};

export type SimklSyncResponse = {
  movies?: SimklSyncItem[];
  shows?: SimklSyncItem[];
  anime?: SimklSyncItem[];
  [key: string]: unknown;
};

type RawSimklItem = {
  title?: string;
  year?: number;
  watched_at?: string;
  last_watched_at?: string;
  user_rating?: number | null;
  rating?: number | null;
  status?: string;
  watched?: boolean;
  [key: string]: unknown;
};

type RawSimklMediaObject = {
  title?: string;
  year?: number;
  ids?: {
    simkl?: number;
    tmdb?: number | string;
    imdb?: string;
    tvdb?: number | string;
    mal?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type RawSimklEntry = RawSimklItem & {
  movie?: RawSimklMediaObject;
  show?: RawSimklMediaObject;
};

function assertConfig() {
  if (!SIMKL_CLIENT_ID) {
    throw new Error(
      "SIMKL_CLIENT_ID is not configured.",
    );
  }
}

function buildUrl(
  path: string,
  params?: Record<string, string>,
) {
  assertConfig();

  const url = new URL(
    `${SIMKL_API_BASE}${path}`,
  );

  url.searchParams.set(
    "client_id",
    SIMKL_CLIENT_ID!,
  );

  url.searchParams.set(
    "app-name",
    SIMKL_APP_NAME,
  );

  url.searchParams.set(
    "app-version",
    SIMKL_APP_VERSION,
  );

  for (const [key, value] of Object.entries(
    params ?? {},
  )) {
    url.searchParams.set(key, value);
  }

  return url;
}

async function simklFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(path, params);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": SIMKL_USER_AGENT,
    },
    cache: "no-store",
  });

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : `Simkl request failed (${response.status}).`;

    const error = new Error(message);

    (
      error as Error & {
        status?: number;
      }
    ).status = response.status;

    throw error;
  }

  return data as T;
}

function normalizeEntry(
  entry: RawSimklEntry,
  mediaType: "movie" | "tv",
): SimklSyncItem {
  const media =
    mediaType === "movie"
      ? entry.movie
      : entry.show;

  return {
    ...entry,
    title:
      media?.title ??
      entry.title,
    year:
      media?.year ??
      entry.year,
    ids:
      media?.ids,
  };
}

function normalizeLibraryResponse(
  response: {
    movies?: RawSimklEntry[];
    shows?: RawSimklEntry[];
    anime?: RawSimklEntry[];
    [key: string]: unknown;
  },
  type: SimklMediaType,
): SimklSyncResponse {
  if (type === "movies") {
    return {
      movies: (response.movies ?? []).map(
        (entry) =>
          normalizeEntry(
            entry,
            "movie",
          ),
      ),
    };
  }

  if (type === "shows") {
    return {
      shows: (response.shows ?? []).map(
        (entry) =>
          normalizeEntry(
            entry,
            "tv",
          ),
      ),
    };
  }

  return {
    anime: (response.anime ?? []).map(
      (entry) =>
        normalizeEntry(
          entry,
          "tv",
        ),
    ),
  };
}

export async function getSimklActivities(
  accessToken: string,
) {
  return simklFetch<SimklActivity>(
    "/sync/activities",
    accessToken,
  );
}

export async function getInitialSimklLibrary(
  accessToken: string,
) {
  /*
   * Simkl's current API exposes the
   * filtered initial-library endpoints
   * under /sync/all-items/{type}.
   *
   * Keep the three library requests
   * separate and sequential so the
   * initial sync does not create a burst.
   */
  const rawShows =
    await simklFetch<{
      shows?: RawSimklEntry[];
      [key: string]: unknown;
    }>(
      "/sync/all-items/shows",
      accessToken,
    );

  const rawMovies =
    await simklFetch<{
      movies?: RawSimklEntry[];
      [key: string]: unknown;
    }>(
      "/sync/all-items/movies",
      accessToken,
    );

  const rawAnime =
    await simklFetch<{
      anime?: RawSimklEntry[];
      [key: string]: unknown;
    }>(
      "/sync/all-items/anime",
      accessToken,
    );

  return {
    shows: normalizeLibraryResponse(
      rawShows,
      "shows",
    ),
    movies: normalizeLibraryResponse(
      rawMovies,
      "movies",
    ),
    anime: normalizeLibraryResponse(
      rawAnime,
      "anime",
    ),
  };
}

export async function getSimklDelta(
  accessToken: string,
  dateFrom: string,
) {
  return simklFetch<SimklSyncResponse>(
    "/sync/all-items",
    accessToken,
    {
      date_from: dateFrom,
    },
  );
}
