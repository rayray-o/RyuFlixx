"use client";

export interface AnimeWatchHistory {
  key: string;

  anime_id: string;
  episode: number;

  title: string;

  poster?: string;
  image?: string;

  episode_title?: string | null;

  current_time: number;
  duration: number;

  completed: boolean;

  updated_at: string;
}

const ANIME_HISTORY_KEY =
  "ryuflix_anime_watch_history_v1";

const ANIME_HISTORY_EVENT =
  "ryuflix-anime-history-updated";

const MAX_ANIME_HISTORY_ITEMS = 100;

function isBrowser() {
  return typeof window !== "undefined";
}

function emit() {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(
      ANIME_HISTORY_EVENT,
    ),
  );
}

function safelyParse<T>(
  value: string | null,
  fallback: T,
): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getAnimeHistoryKey(
  animeId: string,
  episode: number,
) {
  return `anime-${animeId}-episode-${episode}`;
}

export function getAnimeWatchHistory(): AnimeWatchHistory[] {
  if (!isBrowser()) return [];

  const history =
    safelyParse<AnimeWatchHistory[]>(
      window.localStorage.getItem(
        ANIME_HISTORY_KEY,
      ),
      [],
    );

  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (item) =>
        item &&
        typeof item.key === "string" &&
        typeof item.anime_id === "string" &&
        typeof item.episode === "number" &&
        typeof item.current_time ===
          "number" &&
        typeof item.duration ===
          "number" &&
        typeof item.updated_at ===
          "string",
    )
    .map((item) => ({
      ...item,

      current_time: Math.max(
        0,
        item.current_time,
      ),

      duration: Math.max(
        0,
        item.duration,
      ),

      completed:
        Boolean(item.completed),
    }))
    .sort(
      (a, b) =>
        new Date(
          b.updated_at,
        ).getTime() -
        new Date(
          a.updated_at,
        ).getTime(),
    );
}

export function getAnimeEpisodeProgress(
  animeId: string,
  episode: number,
): AnimeWatchHistory | null {
  const key =
    getAnimeHistoryKey(
      animeId,
      episode,
    );

  return (
    getAnimeWatchHistory().find(
      (item) =>
        item.key === key,
    ) ?? null
  );
}

export function saveAnimeWatchProgress(
  metadata: {
    animeId: string;
    episode: number;
    title: string;
    poster?: string;
    image?: string;
    episodeTitle?: string | null;
  },
  currentTime: number,
  duration: number,
  completed = false,
) {
  if (!isBrowser()) return;

  if (
    !Number.isFinite(
      currentTime,
    )
  ) {
    return;
  }

  const safeCurrentTime =
    Math.max(0, currentTime);

  const safeDuration =
    Number.isFinite(duration) &&
    duration > 0
      ? duration
      : 0;

  /*
   * Don't create a useless record
   * before playback has actually started.
   */
  if (
    safeCurrentTime <= 0 &&
    !completed
  ) {
    return;
  }

  const key =
    getAnimeHistoryKey(
      metadata.animeId,
      metadata.episode,
    );

  const history =
    getAnimeWatchHistory();

  const existingIndex =
    history.findIndex(
      (item) =>
        item.key === key,
    );

  const existing =
    existingIndex >= 0
      ? history[
          existingIndex
        ]
      : undefined;

  /*
   * Never replace a known duration
   * with a temporary zero duration.
   */
  const finalDuration =
    safeDuration > 0
      ? safeDuration
      : existing?.duration ?? 0;

  const finalTime =
    finalDuration > 0
      ? Math.min(
          safeCurrentTime,
          finalDuration,
        )
      : safeCurrentTime;

  const item: AnimeWatchHistory =
    {
      key,

      anime_id:
        metadata.animeId,

      episode:
        metadata.episode,

      title:
        metadata.title,

      poster:
        metadata.poster,

      image:
        metadata.image,

      episode_title:
        metadata.episodeTitle ??
        null,

      current_time:
        completed
          ? finalDuration ||
            finalTime
          : finalTime,

      duration:
        finalDuration,

      completed,

      updated_at:
        new Date().toISOString(),
    };

  if (existingIndex >= 0) {
    history.splice(
      existingIndex,
      1,
    );
  }

  history.unshift(item);

  const trimmed =
    history.slice(
      0,
      MAX_ANIME_HISTORY_ITEMS,
    );

  try {
    window.localStorage.setItem(
      ANIME_HISTORY_KEY,
      JSON.stringify(trimmed),
    );

    emit();
  } catch (error) {
    console.error(
      "RyuFlixx: failed to save anime watch history",
      error,
    );
  }
}

export function removeAnimeWatchHistory(
  animeId: string,
  episode: number,
) {
  if (!isBrowser()) return;

  const key =
    getAnimeHistoryKey(
      animeId,
      episode,
    );

  const history =
    getAnimeWatchHistory().filter(
      (item) =>
        item.key !== key,
    );

  window.localStorage.setItem(
    ANIME_HISTORY_KEY,
    JSON.stringify(history),
  );

  emit();
}

export function clearAnimeWatchHistory() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(
    ANIME_HISTORY_KEY,
  );

  emit();
}

export function getAnimeHistoryEventName() {
  return ANIME_HISTORY_EVENT;
}
