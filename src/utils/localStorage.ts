"use client";

import type { ContentType } from "@/types";

export interface LocalWatchHistory {
  key: string;

  media_id: number;
  type: ContentType;

  season: number;
  episode: number;

  title: string;

  backdrop_path: string | null;
  poster_path: string | null;

  release_date: string;
  vote_average: number;
  adult: boolean;

  duration: number;
  last_position: number;

  completed: boolean;

  updated_at: string;
}

export interface LocalWatchlistItem {
  id: number;
  type: ContentType;

  adult: boolean;

  backdrop_path: string;
  poster_path: string | null;

  release_date: string;
  title: string;
  vote_average: number;

  created_at: string;
}

const HISTORY_KEY = "ryuflix_watch_history_v1";
const WATCHLIST_KEY = "ryuflix_watchlist_v1";

const MAX_HISTORY_ITEMS = 20;

function readStorage<T>(
  key: string,
  fallback: T,
): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(
  key: string,
  value: T,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // Storage can fail if the browser is full
    // or storage access is unavailable.
  }
}

/* -------------------------------------------------------------------------- */
/*                              WATCH HISTORY                                 */
/* -------------------------------------------------------------------------- */

export function getWatchHistory(): LocalWatchHistory[] {
  const history = readStorage<LocalWatchHistory[]>(
    HISTORY_KEY,
    [],
  );

  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (item) =>
        item &&
        typeof item.media_id === "number" &&
        (item.type === "movie" || item.type === "tv"),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime(),
    );
}

export function getHistoryKey(
  mediaId: number,
  type: ContentType,
  season = 0,
  episode = 0,
): string {
  return `${type}:${mediaId}:${season}:${episode}`;
}

export function getMovieLastPosition(
  mediaId: number,
): number {
  const key = getHistoryKey(
    mediaId,
    "movie",
    0,
    0,
  );

  const item = getWatchHistory().find(
    (history) => history.key === key,
  );

  return item?.completed
    ? 0
    : item?.last_position || 0;
}

export function getTvShowLastPosition(
  mediaId: number,
  season: number,
  episode: number,
): number {
  const key = getHistoryKey(
    mediaId,
    "tv",
    season,
    episode,
  );

  const item = getWatchHistory().find(
    (history) => history.key === key,
  );

  return item?.completed
    ? 0
    : item?.last_position || 0;
}

export function saveWatchProgress(
  data: Omit<
    LocalWatchHistory,
    "key" | "updated_at"
  >,
): void {
  if (
    !data.media_id ||
    !data.duration ||
    data.last_position < 0
  ) {
    return;
  }

  const key = getHistoryKey(
    data.media_id,
    data.type,
    data.season,
    data.episode,
  );

  const now = new Date().toISOString();

  const history = getWatchHistory();

  const entry: LocalWatchHistory = {
    ...data,
    key,
    updated_at: now,
  };

  const existingIndex = history.findIndex(
    (item) => item.key === key,
  );

  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.unshift(entry);
  }

  /*
   * Keep the most recently updated items only.
   * This prevents the browser's local storage from
   * growing indefinitely.
   */
  history.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() -
      new Date(a.updated_at).getTime(),
  );

  writeStorage(
    HISTORY_KEY,
    history.slice(0, MAX_HISTORY_ITEMS),
  );

  window.dispatchEvent(
    new CustomEvent("ryuflix-history-updated"),
  );
}

export function markWatchCompleted(
  mediaId: number,
  type: ContentType,
  season = 0,
  episode = 0,
): void {
  const key = getHistoryKey(
    mediaId,
    type,
    season,
    episode,
  );

  const history = getWatchHistory();

  const existingIndex = history.findIndex(
    (item) => item.key === key,
  );

  if (existingIndex < 0) {
    return;
  }

  history[existingIndex] = {
    ...history[existingIndex],
    completed: true,
    last_position: history[existingIndex].duration,
    updated_at: new Date().toISOString(),
  };

  writeStorage(HISTORY_KEY, history);

  window.dispatchEvent(
    new CustomEvent("ryuflix-history-updated"),
  );
}

export function removeWatchHistory(
  mediaId: number,
  type: ContentType,
  season = 0,
  episode = 0,
): void {
  const key = getHistoryKey(
    mediaId,
    type,
    season,
    episode,
  );

  const history = getWatchHistory().filter(
    (item) => item.key !== key,
  );

  writeStorage(HISTORY_KEY, history);

  window.dispatchEvent(
    new CustomEvent("ryuflix-history-updated"),
  );
}

export function clearWatchHistory(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore storage errors.
  }

  window.dispatchEvent(
    new CustomEvent("ryuflix-history-updated"),
  );
}

/* -------------------------------------------------------------------------- */
/*                                WATCHLIST                                   */
/* -------------------------------------------------------------------------- */

export function getLocalWatchlist(): LocalWatchlistItem[] {
  const watchlist = readStorage<
    LocalWatchlistItem[]
  >(WATCHLIST_KEY, []);

  if (!Array.isArray(watchlist)) {
    return [];
  }

  return watchlist.sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime(),
  );
}

export function isInLocalWatchlist(
  id: number,
  type: ContentType,
): boolean {
  return getLocalWatchlist().some(
    (item) =>
      item.id === id &&
      item.type === type,
  );
}

export function addToLocalWatchlist(
  item: Omit<
    LocalWatchlistItem,
    "created_at"
  >,
): boolean {
  const watchlist =
    getLocalWatchlist();

  const exists = watchlist.some(
    (entry) =>
      entry.id === item.id &&
      entry.type === item.type,
  );

  if (exists) {
    return false;
  }

  watchlist.unshift({
    ...item,
    created_at: new Date().toISOString(),
  });

  writeStorage(
    WATCHLIST_KEY,
    watchlist,
  );

  window.dispatchEvent(
    new CustomEvent("ryuflix-watchlist-updated"),
  );

  return true;
}

export function removeFromLocalWatchlist(
  id: number,
  type: ContentType,
): boolean {
  const watchlist =
    getLocalWatchlist();

  const next = watchlist.filter(
    (item) =>
      !(
        item.id === id &&
        item.type === type
      ),
  );

  if (next.length === watchlist.length) {
    return false;
  }

  writeStorage(
    WATCHLIST_KEY,
    next,
  );

  window.dispatchEvent(
    new CustomEvent("ryuflix-watchlist-updated"),
  );

  return true;
}

export function clearLocalWatchlist(
  type?: ContentType,
): number {
  const watchlist =
    getLocalWatchlist();

  const next = type
    ? watchlist.filter(
        (item) => item.type !== type,
      )
    : [];

  const removed =
    watchlist.length - next.length;

  writeStorage(
    WATCHLIST_KEY,
    next,
  );

  window.dispatchEvent(
    new CustomEvent("ryuflix-watchlist-updated"),
  );

  return removed;
}
