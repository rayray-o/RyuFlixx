
"use client";

import { ContentType } from "@/types";
import { getProfileStorageKey } from "@/utils/profiles";

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

export interface TvShowContinuation {
  mediaId: number;
  season: number;
  episode: number;
}

const WATCH_HISTORY_KEY = "ryuflix_watch_history_v1";
const WATCHLIST_KEY = "ryuflix_watchlist_v1";
const TV_CONTINUATION_KEY = "ryuflix_tv_continuation_v1";

const MAX_HISTORY_ITEMS = 100;

const HISTORY_EVENT = "ryuflix-history-updated";
const WATCHLIST_EVENT = "ryuflix-watchlist-updated";
const TV_CONTINUATION_EVENT = "ryuflix-tv-continuation-updated";

function isBrowser() {
  return typeof window !== "undefined";
}

function key(baseKey: string) {
  return getProfileStorageKey(baseKey);
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
    window.localStorage.getItem(key(WATCH_HISTORY_KEY)),
    [],
  );

  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        typeof item.key === "string" &&
        typeof item.media_id === "number" &&
        (item.type === "movie" || item.type === "tv") &&
        typeof item.last_position === "number" &&
        Number.isFinite(item.last_position) &&
        typeof item.duration === "number" &&
        Number.isFinite(item.duration) &&
        typeof item.updated_at === "string",
    )
    .map((item) => ({
      ...item,
      last_position: Math.max(0, item.last_position),
      duration: Math.max(0, item.duration),
      completed: Boolean(item.completed),
    }))
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime(),
    );
}

export function getMovieLastPosition(mediaId: number): number {
  const item = getWatchHistory().find(
    (entry) => entry.key === getHistoryKey(mediaId, "movie"),
  );

  if (!item || item.completed) return 0;

  if (item.duration > 0 && item.last_position >= item.duration) {
    return 0;
  }

  return Math.max(0, item.last_position);
}

export function getTvShowLastPosition(
  mediaId: number,
  season: number,
  episode: number,
): number {
  const item = getWatchHistory().find(
    (entry) =>
      entry.key === getHistoryKey(mediaId, "tv", season, episode),
  );

  if (!item || item.completed) return 0;

  if (item.duration > 0 && item.last_position >= item.duration) {
    return 0;
  }

  return Math.max(0, item.last_position);
}

export function saveWatchProgress(
  metadata: WatchProgressMetadata,
  currentTime: number,
  duration: number,
  completed = false,
) {
  if (!isBrowser() || !Number.isFinite(currentTime)) return;

  const safeCurrentTime = Math.max(0, currentTime);

  const reportedDuration =
    Number.isFinite(duration) && duration > 0 ? duration : 0;

  const historyKey = getHistoryKey(
    metadata.mediaId,
    metadata.mediaType,
    metadata.season,
    metadata.episode,
  );

  const history = getWatchHistory();

  const existingIndex = history.findIndex(
    (item) => item.key === historyKey,
  );

  const existing =
    existingIndex >= 0 ? history[existingIndex] : undefined;

  const safeDuration =
    reportedDuration > 0
      ? reportedDuration
      : existing?.duration && existing.duration > 0
        ? existing.duration
        : 0;

  if (safeCurrentTime <= 0 && !completed && !existing) return;

  const normalizedPosition =
    safeDuration > 0
      ? Math.min(safeCurrentTime, safeDuration)
      : safeCurrentTime;

  const finalPosition = completed
    ? safeDuration || normalizedPosition
    : normalizedPosition;

  const item: LocalWatchHistory = {
    key: historyKey,
    media_id: metadata.mediaId,
    type: metadata.mediaType,
    title: metadata.title,
    backdrop_path: metadata.backdrop_path,
    poster_path: metadata.poster_path,
    release_date: metadata.release_date,
    vote_average: metadata.vote_average,
    season: metadata.season,
    episode: metadata.episode,
    last_position: finalPosition,
    duration: safeDuration,
    completed,
    updated_at: new Date().toISOString(),
  };

  if (existingIndex >= 0) history.splice(existingIndex, 1);

  history.unshift(item);

  try {
    window.localStorage.setItem(
      key(WATCH_HISTORY_KEY),
      JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)),
    );

    emit(HISTORY_EVENT);
  } catch (error) {
    console.error("RyuFlixx: failed to save watch history", error);
  }
}

export function markWatchCompleted(
  metadata: WatchProgressMetadata,
  duration: number,
) {
  saveWatchProgress(metadata, duration, duration, true);
}

export function removeWatchHistory(
  mediaId: number,
  mediaType: ContentType,
  season?: number,
  episode?: number,
) {
  if (!isBrowser()) return;

  const historyKey = getHistoryKey(
    mediaId,
    mediaType,
    season,
    episode,
  );

  const history = getWatchHistory().filter(
    (item) => item.key !== historyKey,
  );

  window.localStorage.setItem(
    key(WATCH_HISTORY_KEY),
    JSON.stringify(history),
  );

  emit(HISTORY_EVENT);
}

export function clearWatchHistory() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(key(WATCH_HISTORY_KEY));
  emit(HISTORY_EVENT);
}

/* =========================================================
   TV SHOW CONTINUATION
   ========================================================= */

export function getTvContinuation(
  mediaId: number,
): TvShowContinuation | null {
  if (!isBrowser()) return null;

  const all = safelyParse<Record<string, TvShowContinuation>>(
    window.localStorage.getItem(key(TV_CONTINUATION_KEY)),
    {},
  );

  const continuation = all[String(mediaId)];

  if (!continuation) return null;

  if (
    typeof continuation.mediaId !== "number" ||
    typeof continuation.season !== "number" ||
    typeof continuation.episode !== "number"
  ) {
    return null;
  }

  return continuation;
}

export function setTvContinuation(
  continuation: TvShowContinuation,
) {
  if (!isBrowser()) return;

  if (
    !Number.isFinite(continuation.mediaId) ||
    !Number.isFinite(continuation.season) ||
    !Number.isFinite(continuation.episode)
  ) {
    return;
  }

  const all = safelyParse<Record<string, TvShowContinuation>>(
    window.localStorage.getItem(key(TV_CONTINUATION_KEY)),
    {},
  );

  all[String(continuation.mediaId)] = {
    mediaId: continuation.mediaId,
    season: continuation.season,
    episode: continuation.episode,
  };

  try {
    window.localStorage.setItem(
      key(TV_CONTINUATION_KEY),
      JSON.stringify(all),
    );

    emit(TV_CONTINUATION_EVENT);
  } catch (error) {
    console.error("RyuFlixx: failed to save TV continuation", error);
  }
}

export function clearTvContinuation(mediaId: number) {
  if (!isBrowser()) return;

  const all = safelyParse<Record<string, TvShowContinuation>>(
    window.localStorage.getItem(key(TV_CONTINUATION_KEY)),
    {},
  );

  delete all[String(mediaId)];

  window.localStorage.setItem(
    key(TV_CONTINUATION_KEY),
    JSON.stringify(all),
  );

  emit(TV_CONTINUATION_EVENT);
}

/* =========================================================
   WATCHLIST
   ========================================================= */

export function getLocalWatchlist(): LocalWatchlistItem[] {
  if (!isBrowser()) return [];

  const list = safelyParse<LocalWatchlistItem[]>(
    window.localStorage.getItem(key(WATCHLIST_KEY)),
    [],
  );

  return Array.isArray(list) ? list : [];
}

export function isInLocalWatchlist(
  id: number,
  type: ContentType,
) {
  return getLocalWatchlist().some(
    (item) => item.id === id && item.type === type,
  );
}

export function addToLocalWatchlist(
  item: Omit<LocalWatchlistItem, "saved_date">,
) {
  if (!isBrowser()) return;

  const list = getLocalWatchlist();

  const exists = list.some(
    (entry) => entry.id === item.id && entry.type === item.type,
  );

  if (exists) return;

  list.unshift({
    ...item,
    saved_date: new Date().toISOString(),
  });

  window.localStorage.setItem(
    key(WATCHLIST_KEY),
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
    (item) => !(item.id === id && item.type === type),
  );

  window.localStorage.setItem(
    key(WATCHLIST_KEY),
    JSON.stringify(list),
  );

  emit(WATCHLIST_EVENT);
}

export function clearLocalWatchlist(type?: ContentType) {
  if (!isBrowser()) return;

  if (!type) {
    window.localStorage.removeItem(key(WATCHLIST_KEY));
  } else {
    const filtered = getLocalWatchlist().filter(
      (item) => item.type !== type,
    );

    window.localStorage.setItem(
      key(WATCHLIST_KEY),
      JSON.stringify(filtered),
    );
  }

  emit(WATCHLIST_EVENT);
}
