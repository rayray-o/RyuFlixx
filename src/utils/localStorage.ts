"use client";

import { ContentType } from "@/types";

export interface LocalWatchHistory {
  key: string;
  media_id: number;
  type: ContentType;

  title: string;
  backdrop_path: string;
  poster_path?: string;
  release_date: string;
  vote_average: number;

  season?: number;
  episode?: number;

  last_position: number;
  duration: number;
  completed: boolean;
  updated_at: string;
}

export interface LocalWatchlistItem {
  id: number;
  type: ContentType;
  adult: boolean;
  backdrop_path: string;
  poster_path?: string;
  release_date: string;
  title: string;
  vote_average: number;
  saved_date: string;
}

export interface WatchProgressMetadata {
  mediaId: number;
  mediaType: ContentType;

  title: string;
  backdrop_path: string;
  poster_path?: string;
  release_date: string;
  vote_average: number;

  season?: number;
  episode?: number;
}

const WATCH_HISTORY_KEY = "ryuflix_watch_history_v1";
const WATCHLIST_KEY = "ryuflix_watchlist_v1";

const MAX_HISTORY_ITEMS = 20;

const HISTORY_EVENT = "ryuflix-history-updated";
const WATCHLIST_EVENT = "ryuflix-watchlist-updated";

function isBrowser() {
  return typeof window !== "undefined";
}

function emit(name: string) {
  if (!isBrowser()) return;

  window.dispatchEvent(new CustomEvent(name));
}

function safelyParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* =========================================================
   WATCH HISTORY
   ========================================================= */

export function getHistoryKey(
  mediaId: number,
  mediaType: ContentType,
  season?: number,
  episode?: number,
) {
  if (mediaType === "tv") {
    return `tv-${mediaId}-s${season ?? 0}-e${episode ?? 0}`;
  }

  return `movie-${mediaId}`;
}

export function getWatchHistory(): LocalWatchHistory[] {
  if (!isBrowser()) return [];

  const history = safelyParse<LocalWatchHistory[]>(
    window.localStorage.getItem(WATCH_HISTORY_KEY),
    [],
  );

  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        typeof item.key === "string" &&
        typeof item.media_id === "number" &&
        (item.type === "movie" || item.type === "tv"),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime(),
    );
}

export function getMovieLastPosition(mediaId: number): number {
  const key = getHistoryKey(mediaId, "movie");

  const item = getWatchHistory().find(
    (entry) => entry.key === key,
  );

  if (!item || item.completed) return 0;

  return Math.max(0, item.last_position);
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
    (entry) => entry.key === key,
  );

  if (!item || item.completed) return 0;

  return Math.max(0, item.last_position);
}

export function saveWatchProgress(
  metadata: WatchProgressMetadata,
  currentTime: number,
  duration: number,
  completed = false,
) {
  if (!isBrowser()) return;

  if (!Number.isFinite(currentTime)) return;

  const safeCurrentTime = Math.max(0, currentTime);
  const safeDuration =
    Number.isFinite(duration) && duration > 0
      ? duration
      : 0;

  if (safeCurrentTime <= 0 && !completed) {
    return;
  }

  const key = getHistoryKey(
    metadata.mediaId,
    metadata.mediaType,
    metadata.season,
    metadata.episode,
  );

  const history = getWatchHistory();

  const existingIndex = history.findIndex(
    (item) => item.key === key,
  );

  const now = new Date().toISOString();

  const item: LocalWatchHistory = {
    key,

    media_id: metadata.mediaId,
    type: metadata.mediaType,

    title: metadata.title,
    backdrop_path: metadata.backdrop_path,
    poster_path: metadata.poster_path,
    release_date: metadata.release_date,
    vote_average: metadata.vote_average,

    season: metadata.season,
    episode: metadata.episode,

    last_position: completed
      ? safeDuration || safeCurrentTime
      : safeCurrentTime,

    duration: safeDuration,

    completed,

    updated_at: now,
  };

  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }

  history.unshift(item);

  const trimmed = history.slice(
    0,
    MAX_HISTORY_ITEMS,
  );

  try {
    window.localStorage.setItem(
      WATCH_HISTORY_KEY,
      JSON.stringify(trimmed),
    );

    emit(HISTORY_EVENT);
  } catch (error) {
    console.error(
      "RyuFlixx: failed to save watch history",
      error,
    );
  }
}

export function markWatchCompleted(
  metadata: WatchProgressMetadata,
  duration: number,
) {
  saveWatchProgress(
    metadata,
    duration,
    duration,
    true,
  );
}

export function removeWatchHistory(
  mediaId: number,
  mediaType: ContentType,
  season?: number,
  episode?: number,
) {
  if (!isBrowser()) return;

  const key = getHistoryKey(
    mediaId,
    mediaType,
    season,
    episode,
  );

  const history = getWatchHistory().filter(
    (item) => item.key !== key,
  );

  window.localStorage.setItem(
    WATCH_HISTORY_KEY,
    JSON.stringify(history),
  );

  emit(HISTORY_EVENT);
}

export function clearWatchHistory() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(
    WATCH_HISTORY_KEY,
  );

  emit(HISTORY_EVENT);
}

/* =========================================================
   WATCHLIST
   ========================================================= */

export function getLocalWatchlist(): LocalWatchlistItem[] {
  if (!isBrowser()) return [];

  const list = safelyParse<LocalWatchlistItem[]>(
    window.localStorage.getItem(WATCHLIST_KEY),
    [],
  );

  if (!Array.isArray(list)) return [];

  return list;
}

export function isInLocalWatchlist(
  id: number,
  type: ContentType,
) {
  return getLocalWatchlist().some(
    (item) =>
      item.id === id &&
      item.type === type,
  );
}

export function addToLocalWatchlist(
  item: Omit<
    LocalWatchlistItem,
    "saved_date"
  >,
) {
  if (!isBrowser()) return;

  const list = getLocalWatchlist();

  const exists = list.some(
    (entry) =>
      entry.id === item.id &&
      entry.type === item.type,
  );

  if (exists) return;

  list.unshift({
    ...item,
    saved_date: new Date().toISOString(),
  });

  window.localStorage.setItem(
    WATCHLIST_KEY,
    JSON.stringify(list),
  );

  emit(WATCHLIST_EVENT);
}

export function removeFromLocalWatchlist(
  id: number,
  type: ContentType,
) {
  if (!isBrowser()) return;

  const list = getLocalWatchlist().filter(
    (item) =>
      !(
        item.id === id &&
        item.type === type
      ),
  );

  window.localStorage.setItem(
    WATCHLIST_KEY,
    JSON.stringify(list),
  );

  emit(WATCHLIST_EVENT);
}

export function clearLocalWatchlist(
  type?: ContentType,
) {
  if (!isBrowser()) return;

  if (!type) {
    window.localStorage.removeItem(
      WATCHLIST_KEY,
    );
  } else {
    const filtered = getLocalWatchlist().filter(
      (item) => item.type !== type,
    );

    window.localStorage.setItem(
      WATCHLIST_KEY,
      JSON.stringify(filtered),
    );
  }

  emit(WATCHLIST_EVENT);
    }
