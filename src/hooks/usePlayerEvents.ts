"use client";

import { ContentType } from "@/types";
import { saveWatchProgress } from "@/utils/localStorage";
import { type RefObject, useCallback, useEffect, useRef } from "react";

export type PlayerEventType =
  | "play"
  | "pause"
  | "seeked"
  | "ended"
  | "timeupdate";

export interface UnifiedPlayerEventData {
  event: PlayerEventType;
  currentTime: number;
  duration: number;
  mediaId: string | number;
  mediaType: ContentType;
  season?: number;
  episode?: number;
  progress?: number;
}

type PlayerMessage = Record<string, any>;

const MAX_DURATION_SECONDS = 8 * 60 * 60;
const FRESH_POSITION_WAIT_MS = 650;

const PLAYER_ORIGINS = new Set([
  "https://vidlink.pro",
  "https://www.vidy.st",
  "https://vidy.st",
  "https://embed.filmu.in",
  "https://embed.vidrift.net",
  "https://embed.vidrift.in",
  "https://vidsrc.sh",
  "https://vidsrc2.ru",
  "https://vidsrc.in",
  "https://vidsrc.ru",
  "https://vidsrc.su",
  "https://vidsrc.ir",
  "https://vidsrcme.ir",
  "https://vidsrcme.ru",
  "https://vidsrcme.su",
  "https://vidsrc-me.ru",
  "https://vidsrc-me.ir",
  "https://multiembed.mov",
  "https://www.nontongo.win",
  "https://vidcore.org",
  "https://vidcore.io",
  "https://filmku.stream",
  "https://www.2embed.cc",
  "https://2embed.cc",
  "https://vidstuck.xyz",
  "https://vidstuck.cc",
  "https://player.videasy.to",
  "https://player.videasy.ws",
]);

function isRecord(value: unknown): value is PlayerMessage {
  return Boolean(value) && typeof value === "object";
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function numberFrom(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function unwrapMessage(value: unknown): PlayerMessage | null {
  let current = parseJson(value);

  if (!isRecord(current)) return null;

  for (let i = 0; i < 5; i += 1) {
    if (current.data === undefined) break;

    const next = parseJson(current.data);
    if (!isRecord(next)) break;

    current = next;
  }

  return current;
}

function normalizeEvent(value: unknown): PlayerEventType | null {
  if (typeof value !== "string") return null;

  const event = value.toLowerCase().trim();

  if (["play", "playing", "started", "start", "resume", "resumed"].includes(event)) {
    return "play";
  }

  if (["pause", "paused"].includes(event)) return "pause";
  if (["seek", "seeked"].includes(event)) return "seeked";
  if (["ended", "completed", "complete", "finished"].includes(event)) {
    return "ended";
  }

  if (["timeupdate", "time_update", "time-update"].includes(event)) {
    return "timeupdate";
  }

  return null;
}

function normalizeTiming(current: number, duration: number) {
  let currentTime = Math.max(0, current);
  let safeDuration = Math.max(0, duration);

  if (
    safeDuration > MAX_DURATION_SECONDS &&
    safeDuration / 1000 <= MAX_DURATION_SECONDS
  ) {
    safeDuration /= 1000;
  }

  if (
    safeDuration > 0 &&
    currentTime > safeDuration + 2 &&
    currentTime / 1000 <= safeDuration + 2
  ) {
    currentTime /= 1000;
  }

  return { currentTime, duration: safeDuration };
}

function parseProviderMessage(
  origin: string,
  raw: unknown,
): UnifiedPlayerEventData | null {
  const root = parseJson(raw);
  if (!isRecord(root)) return null;

  // Vidstuck documents timestamp as seconds and progress as percentage.
  if (origin === "https://vidstuck.cc" || origin === "https://vidstuck.xyz") {
    const data = unwrapMessage(root);
    if (!data) return null;

    const current = numberFrom(data.timestamp, root.timestamp);
    const duration = numberFrom(data.duration, root.duration);

    if (current === undefined) return null;

    const timing = normalizeTiming(current, duration ?? 0);

    return {
      event: normalizeEvent(data.event ?? data.status) ?? "timeupdate",
      ...timing,
      mediaId: data.id ?? root.id ?? data.tmdbId ?? 0,
      mediaType: String(data.type ?? data.mediaType ?? "").toLowerCase() === "tv"
        ? "tv"
        : "movie",
      season: numberFrom(data.season, data.seasonNumber),
      episode: numberFrom(data.episode, data.episodeNumber),
      progress: numberFrom(data.progress),
    };
  }

  // Vidy sends PLAYER_EVENT and MEDIA_DATA messages.
  if (
    origin === "https://vidy.st" ||
    origin === "https://www.vidy.st"
  ) {
    const type = String(root.type ?? "").toUpperCase();

    if (type === "MEDIA_DATA") {
      const history = unwrapMessage(root.data);
      if (!history) return null;

      const candidates = [
        history,
        history.current,
        history.currentMedia,
        history.current_media,
        history.media,
        history.progress,
        history.player,
      ];

      for (const candidate of candidates) {
        if (!isRecord(candidate)) continue;

        const parsed = parseGenericMessage(candidate);
        if (parsed) return parsed;
      }

      return null;
    }
  }

  if (
    origin === "https://embed.vidrift.net" ||
    origin === "https://embed.vidrift.in"
  ) {
    const type = String(root.type ?? "");

    if (![
      "vidrift:progress",
      "vidrift:paused",
      "vidrift:unpaused",
      "vidrift:ended",
    ].includes(type)) {
      return null;
    }

    const timing = normalizeTiming(
      numberFrom(root.currentTime) ?? 0,
      numberFrom(root.duration) ?? 0,
    );

    return {
      event: type === "vidrift:ended"
        ? "ended"
        : type === "vidrift:paused"
          ? "pause"
          : type === "vidrift:unpaused"
            ? "play"
            : "timeupdate",
      ...timing,
      mediaId: root.tmdbId ?? root.tmdb_id ?? root.mediaId ?? 0,
      mediaType: root.mediaType === "tv" ? "tv" : "movie",
      season: numberFrom(root.season),
      episode: numberFrom(root.episode),
    };
  }

  if (origin === "https://embed.filmu.in") {
    const data = unwrapMessage(root);
    if (!data) return null;

    if (root.type === "SYNC_HISTORY") {
      const timing = normalizeTiming(
        numberFrom(data.watched) ?? 0,
        numberFrom(data.duration) ?? 0,
      );

      return {
        event: "timeupdate",
        ...timing,
        mediaId: data.media_id ?? data.tmdbId ?? data.id ?? 0,
        mediaType: data.media_type === "tv" ? "tv" : "movie",
        season: numberFrom(data.season),
        episode: numberFrom(data.episode),
      };
    }

    if (root.type === "FILMU_PLAYER_EVENT") {
      const event = normalizeEvent(data.event);
      if (!event) return null;

      const timing = normalizeTiming(
        numberFrom(data.currentTime) ?? 0,
        numberFrom(data.duration) ?? 0,
      );

      return {
        event,
        ...timing,
        mediaId: data.tmdbId ?? data.media_id ?? 0,
        mediaType: data.mediaType === "tv" ? "tv" : "movie",
        season: numberFrom(data.season),
        episode: numberFrom(data.episode),
      };
    }
  }

  return parseGenericMessage(root);
}

function parseGenericMessage(raw: unknown): UnifiedPlayerEventData | null {
  const data = unwrapMessage(raw);
  if (!data) return null;

  const player = isRecord(data.player_info)
    ? data.player_info
    : isRecord(data.playerInfo)
      ? data.playerInfo
      : {};

  const value = isRecord(data.value) ? data.value : {};
  const progressObject = isRecord(data.progress) ? data.progress : {};

  const current = numberFrom(
    data.currentTime,
    data.current_time,
    data.position,
    data.current,
    data.time,
    data.seconds,
    data.watched,
    data.player_progress,
    data.playerProgress,
    data.played,
    value.currentTime,
    value.current_time,
    value.position,
    value.seconds,
    value.watched,
    progressObject.watched,
    progressObject.currentTime,
  );

  const duration = numberFrom(
    data.duration,
    data.totalDuration,
    data.total_duration,
    data.length,
    data.videoDuration,
    data.video_duration,
    data.player_duration,
    value.duration,
    value.totalDuration,
    progressObject.duration,
  );

  const progress = numberFrom(
    typeof data.progress === "number" ? data.progress : undefined,
    data.percent,
    data.percentage,
    value.progress,
    value.percent,
    value.percentage,
    progressObject.percentage,
  );

  const event = normalizeEvent(
    data.event ??
    data.eventType ??
    data.event_type ??
    data.action ??
    data.name ??
    data.player_status ??
    data.playerStatus ??
    data.status ??
    data.state ??
    data.playerState ??
    value.event ??
    value.eventType ??
    value.status ??
    value.state,
  ) ?? (
    current !== undefined || duration !== undefined || progress !== undefined
      ? "timeupdate"
      : null
  );

  if (!event || current === undefined) return null;

  const timing = normalizeTiming(current, duration ?? 0);

  return {
    event,
    ...timing,
    mediaId:
      data.mtmdbId ??
      data.tmdbId ??
      data.tmdb_id ??
      data.mediaId ??
      data.media_id ??
      data.id ??
      data.videoId ??
      data.video_id ??
      player.tmdb ??
      player.tmdbId ??
      player.tmdb_id ??
      player.id ??
      0,
    mediaType:
      (data.mediaType ??
        data.media_type ??
        data.contentType ??
        data.content_type ??
        player.mediaType ??
        player.media_type ??
        player.type) === "tv"
        ? "tv"
        : "movie",
    season: numberFrom(
      data.season,
      data.seasonNumber,
      data.season_number,
      data.s,
      player.season,
      player.seasonNumber,
    ),
    episode: numberFrom(
      data.episode,
      data.episodeNumber,
      data.episode_number,
      data.e,
      player.episode,
      player.episodeNumber,
    ),
    progress,
  };
}

export interface UsePlayerEventsOptions {
  metadata?: {
    mediaId?: number;
    mediaType?: ContentType;
    title?: string;
    backdrop_path?: string;
    poster_path?: string;
    release_date?: string;
    vote_average?: number;
    season?: number;
    episode?: number;
    expectedDuration?: number;
  };
  saveHistory?: boolean;
  playerFrameRef?: RefObject<HTMLIFrameElement | null>;
  onPlay?: (data: UnifiedPlayerEventData) => void;
  onPause?: (data: UnifiedPlayerEventData) => void;
  onSeeked?: (data: UnifiedPlayerEventData) => void;
  onEnded?: (data: UnifiedPlayerEventData) => void;
  onTimeUpdate?: (data: UnifiedPlayerEventData) => void;
}

export function usePlayerEvents(options: UsePlayerEventsOptions = {}) {
  const {
    metadata,
    saveHistory = false,
    playerFrameRef,
    onPlay,
    onPause,
    onSeeked,
    onEnded,
    onTimeUpdate,
  } = options;

  const metadataRef = useRef(metadata);
  const saveHistoryRef = useRef(saveHistory);
  const eventDataRef = useRef<UnifiedPlayerEventData | null>(null);
  const callbacksRef = useRef({ onPlay, onPause, onSeeked, onEnded, onTimeUpdate });
  const lastDurationRef = useRef(0);
  const identityRef = useRef("");
  const lastMessageAtRef = useRef(0);
  const freshWaitersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    metadataRef.current = metadata;
    saveHistoryRef.current = saveHistory;
    callbacksRef.current = { onPlay, onPause, onSeeked, onEnded, onTimeUpdate };

    const identity = [
      metadata?.mediaType ?? "",
      metadata?.mediaId ?? "",
      metadata?.season ?? "",
      metadata?.episode ?? "",
    ].join(":");

    if (identity !== identityRef.current) {
      identityRef.current = identity;
      eventDataRef.current = null;
      lastDurationRef.current = 0;
      lastMessageAtRef.current = 0;
    }
  }, [metadata, saveHistory, onPlay, onPause, onSeeked, onEnded, onTimeUpdate]);

  const prepareTiming = useCallback((raw: UnifiedPlayerEventData) => {
    const meta = metadataRef.current;
    const expected = meta?.expectedDuration ?? 0;

    let duration = raw.duration > 0 ? raw.duration : lastDurationRef.current;

    if (
      expected > 0 &&
      (!duration || duration < expected * 0.55 || duration > expected * 1.8)
    ) {
      duration = expected;
    }

    let currentTime = Number.isFinite(raw.currentTime)
      ? Math.max(0, raw.currentTime)
      : -1;

    if (currentTime < 0) return null;

    if (duration > 0 && currentTime > duration + 2) {
      if (currentTime / 1000 <= duration + 2) {
        currentTime /= 1000;
      } else {
        return null;
      }
    }

    if (duration > 0 && currentTime > duration) {
      if (currentTime - duration <= 2) currentTime = duration;
      else return null;
    }

    return { ...raw, currentTime, duration };
  }, []);

  const saveLocalProgress = useCallback((
    raw: UnifiedPlayerEventData,
    completed = false,
    allowZero = false,
  ) => {
    if (!saveHistoryRef.current) return false;

    const meta = metadataRef.current;
    const mediaId = Number(meta?.mediaId ?? raw.mediaId);

    if (
      !Number.isFinite(mediaId) ||
      mediaId <= 0 ||
      !meta?.title ||
      meta.backdrop_path === undefined ||
      meta.release_date === undefined ||
      meta.vote_average === undefined
    ) {
      return false;
    }

    const data = prepareTiming(raw);
    if (!data) return false;

    if (data.currentTime === 0 && !completed && !allowZero) {
      return false;
    }

    saveWatchProgress(
      {
        mediaId,
        mediaType: meta.mediaType ?? data.mediaType,
        title: meta.title,
        backdrop_path: meta.backdrop_path,
        poster_path: meta.poster_path,
        release_date: meta.release_date,
        vote_average: meta.vote_average,
        season: meta.season ?? data.season,
        episode: meta.episode ?? data.episode,
      },
      data.currentTime,
      data.duration,
      completed,
    );

    if (data.duration > 0) lastDurationRef.current = data.duration;
    return true;
  }, [prepareTiming]);

  const flushProgress = useCallback(async () => {
    const before = lastMessageAtRef.current;

    // Give the active provider a short opportunity to deliver its latest
    // position (particularly important immediately after a seek).
    await new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        freshWaitersRef.current = freshWaitersRef.current.filter(
          (waiter) => waiter !== finish,
        );
        resolve();
      };

      const timer = window.setTimeout(finish, FRESH_POSITION_WAIT_MS);
      freshWaitersRef.current.push(finish);

      if (lastMessageAtRef.current > before) finish();
    });

    const latest = eventDataRef.current;
    if (!latest) return false;

    return saveLocalProgress(
      latest,
      latest.event === "ended",
      latest.currentTime === 0,
    );
  }, [saveLocalProgress]);

  const getCurrentTime = useCallback(() => {
    return eventDataRef.current?.currentTime ?? -1;
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!PLAYER_ORIGINS.has(event.origin)) return;
      if (playerFrameRef && !playerFrameRef.current) return;

      const parsed = parseProviderMessage(event.origin, event.data);
      if (!parsed) return;

      const meta = metadataRef.current;
      const mediaType = meta?.mediaType ?? parsed.mediaType;

      if (mediaType !== "movie" && mediaType !== "tv") return;

      const normalized = prepareTiming({
        ...parsed,
        mediaId: meta?.mediaId ?? parsed.mediaId,
        mediaType,
        season: meta?.season ?? parsed.season,
        episode: meta?.episode ?? parsed.episode,
      });

      if (!normalized) return;

      // A provider event is the only reliable live position available to
      // the parent page for a cross-origin iframe.
      eventDataRef.current = normalized;
      lastMessageAtRef.current = Date.now();

      if (normalized.duration > 0) {
        lastDurationRef.current = normalized.duration;
      }

      freshWaitersRef.current.slice().forEach((finish) => finish());

      const callbacks = callbacksRef.current;

      // Persist every valid provider update. This captures small movements
      // as well as large seek jumps rather than waiting for a distance limit.
      if (normalized.event === "ended") {
        saveLocalProgress(normalized, true, true);
        callbacks.onEnded?.(normalized);
        return;
      }

      saveLocalProgress(
        normalized,
        false,
        normalized.event === "seeked" || normalized.currentTime === 0,
      );

      switch (normalized.event) {
        case "play":
          callbacks.onPlay?.(normalized);
          break;
        case "pause":
          callbacks.onPause?.(normalized);
          break;
        case "seeked":
          callbacks.onSeeked?.(normalized);
          break;
        case "timeupdate":
          callbacks.onTimeUpdate?.(normalized);
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      freshWaitersRef.current.slice().forEach((finish) => finish());
    };
  }, [playerFrameRef, prepareTiming, saveLocalProgress]);

  useEffect(() => {
    const saveLatest = () => {
      const latest = eventDataRef.current;
      if (!latest) return;

      saveLocalProgress(
        latest,
        latest.event === "ended",
        latest.currentTime === 0,
      );
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveLatest();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveLatest);

    return () => {
      saveLatest();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", saveLatest);
    };
  }, [saveLocalProgress]);

  return { getCurrentTime, flushProgress };
  }
