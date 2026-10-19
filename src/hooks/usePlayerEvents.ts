"use client";

import { ContentType } from "@/types";
import { saveWatchProgress } from "@/utils/localStorage";
import { type RefObject, useCallback, useEffect, useRef } from "react";

export type PlayerEventType = "play" | "pause" | "seeked" | "ended" | "timeupdate";
export interface BasePlayerEventEnvelope<T = any> { type: string; data?: T }
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
export interface PlayerAdapter<RawMessage extends BasePlayerEventEnvelope<any> = BasePlayerEventEnvelope<any>> {
  origin: `https://${string}`;
  parse: (raw: RawMessage) => UnifiedPlayerEventData | null;
}
export type AdapterMap = Record<string, PlayerAdapter<any>>;

const SAVE_DISTANCE_SECONDS = 2;
const MAX_DURATION_SECONDS = 8 * 60 * 60;
const SUPPORTED_EVENTS: PlayerEventType[] = ["play", "pause", "seeked", "ended", "timeupdate"];

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object";
}
function firstDefined<T>(...values: (T | undefined | null)[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null) as T | undefined;
}
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}
function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}
function unwrapData(raw: unknown): Record<string, any> | null {
  let current = parseMaybeJson(raw);
  if (!isRecord(current)) return null;
  for (let depth = 0; depth < 6; depth += 1) {
    if (!isRecord(current.data)) break;
    current = parseMaybeJson(current.data);
    if (!isRecord(current)) return null;
  }
  return current;
}
function normalizeEvent(value: unknown): PlayerEventType | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (["play", "playing", "started", "start", "resume", "resumed"].includes(v)) return "play";
  if (["pause", "paused"].includes(v)) return "pause";
  if (["seek", "seeked"].includes(v)) return "seeked";
  if (["ended", "completed", "complete", "finished"].includes(v)) return "ended";
  if (["timeupdate", "time_update", "time-update"].includes(v)) return "timeupdate";
  return SUPPORTED_EVENTS.includes(v as PlayerEventType) ? v as PlayerEventType : undefined;
}

/** Normalize common seconds/milliseconds mismatches and reject impossible time pairs. */
function normalizeTiming(current: number, duration: number) {
  let time = Math.max(0, current);
  let length = Math.max(0, duration);
  if (length > MAX_DURATION_SECONDS && length / 1000 <= MAX_DURATION_SECONDS) length /= 1000;
  if (length > 0 && time > length + 2 && time / 1000 <= length + 2) time /= 1000;
  return { currentTime: time, duration: length };
}

function parseGenericPlayerMessage(raw: Record<string, any>): UnifiedPlayerEventData | null {
  const root = parseMaybeJson(raw);
  if (!isRecord(root)) return null;
  const data = unwrapData(root);
  if (!data) return null;
  const playerInfo = isRecord(data.player_info) ? data.player_info : isRecord(data.playerInfo) ? data.playerInfo : undefined;
  const value = isRecord(data.value) ? data.value : undefined;
  const progressObject = isRecord(data.progress) ? data.progress : undefined;

  const current = toNumber(firstDefined(
    data.currentTime, data.current_time, data.position, data.current, data.time, data.seconds,
    data.watched, data.player_progress, value?.currentTime, value?.current_time, value?.position,
    value?.seconds, value?.watched, progressObject?.watched, progressObject?.currentTime,
  )) ?? 0;
  const duration = toNumber(firstDefined(
    data.duration, data.totalDuration, data.total_duration, data.length, data.videoDuration,
    data.video_duration, data.player_duration, value?.duration, value?.totalDuration,
    value?.total_duration, progressObject?.duration,
  )) ?? 0;
  const progress = toNumber(firstDefined(
    typeof data.progress === "number" ? data.progress : undefined, data.percent, data.percentage,
    value?.progress, value?.percent, value?.percentage, progressObject?.percentage,
  ));
  const eventType = normalizeEvent(firstDefined(
    data.event, data.eventType, data.event_type, data.action, data.name, data.player_status,
    data.playerStatus, data.status, data.state, data.playerState, value?.event,
    value?.eventType, value?.status, value?.state,
  )) ?? (current > 0 || duration > 0 || progress !== undefined ? "timeupdate" : undefined);
  if (!eventType) return null;

  const timing = normalizeTiming(current, duration);
  const mediaTypeRaw = firstDefined(
    data.mediaType, data.media_type, data.contentType, data.content_type,
    playerInfo?.mediaType, playerInfo?.media_type,
  );

  return {
    event: eventType,
    currentTime: timing.currentTime,
    duration: timing.duration,
    mediaId: firstDefined(data.mtmdbId, data.tmdbId, data.tmdb_id, data.mediaId, data.media_id, data.id,
      data.videoId, data.video_id, playerInfo?.tmdb, playerInfo?.tmdbId, playerInfo?.tmdb_id, playerInfo?.id) ?? 0,
    mediaType: mediaTypeRaw === "tv" ? "tv" : "movie",
    season: toNumber(firstDefined(data.season, data.seasonNumber, data.season_number, data.s, playerInfo?.season, playerInfo?.seasonNumber, playerInfo?.season_number)),
    episode: toNumber(firstDefined(data.episode, data.episodeNumber, data.episode_number, data.e, playerInfo?.episode, playerInfo?.episodeNumber, playerInfo?.episode_number)),
    progress,
  };
}

function parseVidLinkMessage(raw: Record<string, any>): UnifiedPlayerEventData | null {
  const root = parseMaybeJson(raw);
  if (!isRecord(root)) return null;
  if (root.type !== "MEDIA_DATA") return parseGenericPlayerMessage(root);
  const data = unwrapData(root);
  if (!data) return null;
  const progress = isRecord(data.progress) ? data.progress : undefined;
  const currentTime = toNumber(progress?.watched) ?? 0;
  const duration = toNumber(progress?.duration) ?? 0;
  if (currentTime <= 0 && duration <= 0) return null;
  const timing = normalizeTiming(currentTime, duration);
  return {
    event: "timeupdate", ...timing,
    mediaId: firstDefined(data.id, data.tmdbId, data.tmdb_id) ?? 0,
    mediaType: data.type === "tv" ? "tv" : "movie",
    season: toNumber(firstDefined(data.last_season_watched, data.season)),
    episode: toNumber(firstDefined(data.last_episode_watched, data.episode)),
  };
}

function parseFilmUMessage(raw: Record<string, any>): UnifiedPlayerEventData | null {
  const root = parseMaybeJson(raw);
  if (!isRecord(root)) return null;
  const data = unwrapData(root);
  if (!data) return null;
  if (root.type === "SYNC_HISTORY") {
    const timing = normalizeTiming(toNumber(data.watched) ?? 0, toNumber(data.duration) ?? 0);
    return { event: "timeupdate", ...timing, mediaId: firstDefined(data.media_id, data.tmdbId, data.id) ?? 0,
      mediaType: data.media_type === "tv" ? "tv" : "movie", season: toNumber(data.season), episode: toNumber(data.episode) };
  }
  if (root.type === "FILMU_PLAYER_EVENT") {
    const event = normalizeEvent(data.event);
    if (!event) return null;
    const timing = normalizeTiming(toNumber(data.currentTime) ?? 0, toNumber(data.duration) ?? 0);
    return { event, ...timing, mediaId: firstDefined(data.tmdbId, data.media_id) ?? 0,
      mediaType: data.mediaType === "tv" ? "tv" : "movie", season: toNumber(data.season), episode: toNumber(data.episode) };
  }
  return parseGenericPlayerMessage(root);
}

function parseVidRiftMessage(raw: Record<string, any>): UnifiedPlayerEventData | null {
  const root = parseMaybeJson(raw);
  if (!isRecord(root) || !["vidrift:progress", "vidrift:paused", "vidrift:unpaused", "vidrift:ended"].includes(String(root.type))) return null;
  const timing = normalizeTiming(toNumber(root.currentTime) ?? 0, toNumber(root.duration) ?? 0);
  const eventType: PlayerEventType = root.type === "vidrift:ended" ? "ended" : root.type === "vidrift:paused" ? "pause" : root.type === "vidrift:unpaused" ? "play" : "timeupdate";
  return { event: eventType, ...timing,
    mediaId: firstDefined(root.tmdbId, root.tmdb_id, root.mediaId) ?? 0,
    mediaType: root.mediaType === "tv" ? "tv" : "movie", season: toNumber(root.season), episode: toNumber(root.episode) };
}

const PLAYER_ORIGINS = [
  "https://vidlink.pro",
  "https://embed.filmu.in",
  "https://embed.vidrift.net",
  "https://embed.vidrift.in",
  "https://vidsrc.in", "https://vidsrc.ru", "https://vidsrc.su", "https://vidsrc.ir",
  "https://vidsrcme.ru", "https://vidsrcme.su", "https://vidsrc-me.ru", "https://vidsrc-me.ir",
  "https://multiembed.mov", "https://www.nontongo.win", "https://vidcore.org", "https://vidcore.io",
  "https://filmku.stream", "https://www.2embed.cc", "https://2embed.cc", "https://vidstuck.xyz",
  "https://player.videasy.to", "https://player.videasy.ws",
] as const;
export type PlayerOrigin = (typeof PLAYER_ORIGINS)[number];
const PLAYER_ORIGIN_SET = new Set<string>(PLAYER_ORIGINS);
export const playerAdapters = Object.fromEntries([
  ["https://vidlink.pro", { origin: "https://vidlink.pro", parse: parseVidLinkMessage }],
  ["https://embed.filmu.in", { origin: "https://embed.filmu.in", parse: parseFilmUMessage }],
  ["https://embed.vidrift.net", { origin: "https://embed.vidrift.net", parse: parseVidRiftMessage }],
  ["https://embed.vidrift.in", { origin: "https://embed.vidrift.in", parse: parseVidRiftMessage }],
  ...[
    "https://vidsrc.in", "https://vidsrc.ru", "https://vidsrc.su", "https://vidsrc.ir",
    "https://vidsrcme.ru", "https://vidsrcme.su", "https://vidsrc-me.ru", "https://vidsrc-me.ir",
    "https://multiembed.mov", "https://www.nontongo.win", "https://vidcore.org", "https://vidcore.io",
    "https://filmku.stream", "https://www.2embed.cc", "https://2embed.cc", "https://vidstuck.xyz",
    "https://player.videasy.to", "https://player.videasy.ws",
  ].map((origin) => [origin, { origin, parse: parseGenericPlayerMessage }]),
]) as AdapterMap;

export interface UsePlayerEventsOptions {
  metadata?: {
    mediaId?: number; mediaType?: ContentType; title?: string; backdrop_path?: string; poster_path?: string;
    release_date?: string; vote_average?: number; season?: number; episode?: number;
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
  const { metadata, saveHistory = false, playerFrameRef, onPlay, onPause, onSeeked, onEnded, onTimeUpdate } = options;
  const eventDataRef = useRef<UnifiedPlayerEventData | null>(null);
  const metadataRef = useRef(metadata);
  const saveHistoryRef = useRef(saveHistory);
  const callbacksRef = useRef({ onPlay, onPause, onSeeked, onEnded, onTimeUpdate });
  const lastSavedPositionRef = useRef(0);
  const lastDurationRef = useRef(0);
  const identityRef = useRef<string | null>(null);

  useEffect(() => {
    metadataRef.current = metadata;
    saveHistoryRef.current = saveHistory;
    callbacksRef.current = { onPlay, onPause, onSeeked, onEnded, onTimeUpdate };
    const identity = [metadata?.mediaType ?? "", metadata?.mediaId ?? "", metadata?.season ?? "", metadata?.episode ?? ""].join(":");
    if (identity && identityRef.current !== identity) {
      identityRef.current = identity;
      lastSavedPositionRef.current = 0;
      lastDurationRef.current = 0;
      eventDataRef.current = null;
    }
  }, [metadata, saveHistory, onPlay, onPause, onSeeked, onEnded, onTimeUpdate]);

  const prepareTiming = useCallback((data: UnifiedPlayerEventData) => {
    const meta = metadataRef.current;
    const expected = meta?.expectedDuration && meta.expectedDuration > 0 ? meta.expectedDuration : 0;
    let duration = data.duration > 0 ? data.duration : lastDurationRef.current;
    if (expected > 0 && (!duration || duration < expected * 0.55 || duration > expected * 1.8)) duration = expected;
    let currentTime = Number.isFinite(data.currentTime) ? Math.max(0, data.currentTime) : 0;
    if (duration > 0 && currentTime > duration + 2) {
      if (currentTime / 1000 <= duration + 2) currentTime /= 1000;
      else return null;
    }
    if (duration > 0 && currentTime > duration) {
      if (currentTime - duration <= 2) currentTime = duration;
      else return null;
    }
    return { ...data, currentTime, duration };
  }, []);

  const saveLocalProgress = useCallback((raw: UnifiedPlayerEventData, completed = false, allowZero = false) => {
    if (!saveHistoryRef.current) return;
    const meta = metadataRef.current;
    const mediaId = Number(meta?.mediaId ?? raw.mediaId);
    if (!Number.isFinite(mediaId) || mediaId <= 0) return;
    if (!meta?.title || meta.backdrop_path === undefined || meta.release_date === undefined || meta.vote_average === undefined) return;
    const data = prepareTiming(raw);
    if (!data) {
      console.warn("RyuFlixx: ignored implausible playback timing", { mediaId, currentTime: raw.currentTime, duration: raw.duration });
      return;
    }
    if (data.currentTime <= 0 && !completed && !allowZero) return;
    saveWatchProgress({
      mediaId, mediaType: meta.mediaType ?? data.mediaType, title: meta.title,
      backdrop_path: meta.backdrop_path, poster_path: meta.poster_path,
      release_date: meta.release_date, vote_average: meta.vote_average,
      season: meta.season ?? data.season, episode: meta.episode ?? data.episode,
    }, data.currentTime, data.duration, completed);
    if (data.currentTime > 0) lastSavedPositionRef.current = data.currentTime;
    if (data.duration > 0) lastDurationRef.current = data.duration;
  }, [prepareTiming]);

  const flushProgress = useCallback(() => {
    const latest = eventDataRef.current;
    if (latest) saveLocalProgress(latest, latest.event === "ended", latest.event === "seeked");
  }, [saveLocalProgress]);
  const getCurrentTime = useCallback(() => Math.max(0, eventDataRef.current?.currentTime ?? 0), []);
  const maybeSaveProgress = useCallback((data: UnifiedPlayerEventData, force = false) => {
    if (!saveHistoryRef.current) return;
    if (!force && Math.abs(data.currentTime - lastSavedPositionRef.current) < SAVE_DISTANCE_SECONDS) return;
    saveLocalProgress(data, data.event === "ended", data.event === "seeked");
  }, [saveLocalProgress]);

  useEffect(() => {
    const saveLatest = () => {
      const latest = eventDataRef.current;
      if (latest) saveLocalProgress(latest, latest.event === "ended", latest.event === "seeked");
    };
    const visibility = () => { if (document.visibilityState === "hidden") saveLatest(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", saveLatest);
    return () => {
      saveLatest();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", saveLatest);
    };
  }, [saveLocalProgress]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!PLAYER_ORIGIN_SET.has(event.origin)) return;
      const frame = playerFrameRef?.current;
      if (frame && event.source !== frame.contentWindow) return;
      const raw = parseMaybeJson(event.data);
      if (!isRecord(raw)) return;
      const parsed = playerAdapters[event.origin]?.parse(raw) ?? parseGenericPlayerMessage(raw);
      if (!parsed) return;
      const meta = metadataRef.current;
      const type = meta?.mediaType ?? parsed.mediaType;
      if (type !== "movie" && type !== "tv") return;
      const normalized = prepareTiming({
        ...parsed,
        mediaId: meta?.mediaId ?? parsed.mediaId,
        mediaType: type,
        season: meta?.season ?? parsed.season,
        episode: meta?.episode ?? parsed.episode,
      });
      if (!normalized) return;
      eventDataRef.current = normalized;
      if (normalized.duration > 0) lastDurationRef.current = normalized.duration;
      const cb = callbacksRef.current;
      switch (normalized.event) {
        case "play": cb.onPlay?.(normalized); maybeSaveProgress(normalized); break;
        case "pause": cb.onPause?.(normalized); maybeSaveProgress(normalized, true); break;
        case "seeked": cb.onSeeked?.(normalized); maybeSaveProgress(normalized, true); break;
        case "timeupdate": cb.onTimeUpdate?.(normalized); maybeSaveProgress(normalized); break;
        case "ended": saveLocalProgress(normalized, true); cb.onEnded?.(normalized); break;
      }
      // Never infer completion from 90%: only an explicit provider ended event completes an item.
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [maybeSaveProgress, playerFrameRef, prepareTiming, saveLocalProgress]);

  return { getCurrentTime, flushProgress };
}
