"use client";

import { ContentType } from "@/types";
import { saveWatchProgress } from "@/utils/localStorage";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";

export type PlayerEventType =
  | "play"
  | "pause"
  | "seeked"
  | "ended"
  | "timeupdate";

export interface BasePlayerEventEnvelope<T = any> {
  type:
    | "PLAYER_EVENT"
    | "MEDIA_DATA"
    | string;
  data?: T;
}

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

export interface PlayerAdapter<
  RawMessage extends BasePlayerEventEnvelope<any> =
    BasePlayerEventEnvelope<any>,
> {
  origin: `https://${string}`;

  parse: (
    raw: RawMessage,
  ) => UnifiedPlayerEventData | null;
}

export type AdapterMap =
  Record<string, PlayerAdapter<any>>;

const SUPPORTED_EVENTS: PlayerEventType[] = [
  "play",
  "pause",
  "seeked",
  "ended",
  "timeupdate",
];

const COMPLETION_THRESHOLD = 0.9;

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return (
    Boolean(value) &&
    typeof value === "object"
  );
}

function firstDefined<T>(
  ...values: (T | undefined | null)[]
): T | undefined {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null,
  ) as T | undefined;
}

function toNumber(
  value: unknown,
): number | undefined {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const trimmed =
      value.trim();

    if (!trimmed) {
      return undefined;
    }

    const parsed =
      Number(trimmed);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return undefined;
}

function parseMaybeJson(
  value: unknown,
): unknown {
  if (
    typeof value !== "string"
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeEvent(
  value: unknown,
  hasTimingData = false,
): PlayerEventType | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized === "play" ||
    normalized === "playing" ||
    normalized === "started" ||
    normalized === "start" ||
    normalized === "resume" ||
    normalized === "resumed"
  ) {
    return "play";
  }

  if (
    normalized === "pause" ||
    normalized === "paused"
  ) {
    return "pause";
  }

  if (
    normalized === "seeked" ||
    normalized === "seek"
  ) {
    return "seeked";
  }

  if (
    normalized === "ended" ||
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "finished"
  ) {
    return "ended";
  }

  if (
    normalized === "timeupdate" ||
    normalized === "time_update" ||
    normalized === "time-update"
  ) {
    return "timeupdate";
  }

  if (
    normalized === "progress" &&
    hasTimingData
  ) {
    return "timeupdate";
  }

  if (
    SUPPORTED_EVENTS.includes(
      normalized as PlayerEventType,
    )
  ) {
    return normalized as PlayerEventType;
  }

  return undefined;
}

function unwrapEventData(
  raw: Record<string, any>,
): Record<string, any> | null {
  let data =
    parseMaybeJson(
      raw?.data,
    );

  if (
    !isRecord(data)
  ) {
    data =
      parseMaybeJson(raw);
  }

  if (
    !isRecord(data)
  ) {
    return null;
  }

  let current =
    data;

  for (
    let depth = 0;
    depth < 4;
    depth += 1
  ) {
    if (
      !isRecord(
        current.data,
      )
    ) {
      break;
    }

    current =
      current.data;
  }

  return current;
}

function parseGenericPlayerMessage(
  raw: Record<string, any>,
): UnifiedPlayerEventData | null {
  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return null;
  }

  const data =
    unwrapEventData(raw);

  if (!data) {
    return null;
  }

  const playerInfo =
    isRecord(
      data.player_info,
    )
      ? data.player_info
      : isRecord(
            data.playerInfo,
          )
        ? data.playerInfo
        : undefined;

  const value =
    isRecord(data.value)
      ? data.value
      : undefined;

  const currentTime =
    toNumber(
      firstDefined(
        data.currentTime,
        data.current_time,
        data.position,
        data.current,
        data.time,
        data.seconds,
        data.currentTimeSeconds,
        data.current_time_seconds,
        data.player_progress,
        value?.currentTime,
        value?.current_time,
        value?.position,
        value?.seconds,
      ),
    ) ?? 0;

  const duration =
    toNumber(
      firstDefined(
        data.duration,
        data.totalDuration,
        data.total_duration,
        data.length,
        data.videoDuration,
        data.video_duration,
        data.player_duration,
        value?.duration,
        value?.totalDuration,
        value?.total_duration,
      ),
    ) ?? 0;

  const progress =
    toNumber(
      firstDefined(
        data.progress,
        data.percent,
        data.percentage,
        value?.progress,
        value?.percent,
        value?.percentage,
      ),
    );

  const hasTimingData =
    currentTime > 0 ||
    duration > 0 ||
    progress !== undefined;

  const eventCandidate =
    firstDefined(
      data.event,
      data.eventType,
      data.event_type,
      data.action,
      data.name,
      data.player_status,
      data.playerStatus,
      data.status,
      data.state,
      data.playerState,
      value?.event,
      value?.eventType,
      value?.status,
      value?.state,
      raw.type !==
        "PLAYER_EVENT" &&
        raw.type !==
          "MEDIA_DATA"
        ? raw.type
        : undefined,
    );

  let event =
    normalizeEvent(
      eventCandidate,
      hasTimingData,
    );

  if (
    !event &&
    hasTimingData
  ) {
    event =
      "timeupdate";
  }

  if (!event) {
    return null;
  }

  const mediaId =
    firstDefined(
      data.mtmdbId,
      data.tmdbId,
      data.tmdb_id,
      data.mediaId,
      data.media_id,
      data.id,
      data.videoId,
      data.video_id,
      playerInfo?.tmdb,
      playerInfo?.tmdbId,
      playerInfo?.tmdb_id,
      playerInfo?.id,
    ) ?? 0;

  const mediaTypeRaw =
    firstDefined(
      data.mediaType,
      data.media_type,
      data.contentType,
      data.content_type,
      playerInfo?.mediaType,
      playerInfo?.media_type,
      data.type === "movie"
        ? "movie"
        : data.type === "tv"
          ? "tv"
          : undefined,
    );

  const mediaType =
    mediaTypeRaw === "tv"
      ? "tv"
      : "movie";

  const season =
    toNumber(
      firstDefined(
        data.season,
        data.seasonNumber,
        data.season_number,
        data.s,
        playerInfo?.season,
        playerInfo?.seasonNumber,
        playerInfo?.season_number,
      ),
    );

  const episode =
    toNumber(
      firstDefined(
        data.episode,
        data.episodeNumber,
        data.episode_number,
        data.e,
        playerInfo?.episode,
        playerInfo?.episodeNumber,
        playerInfo?.episode_number,
      ),
    );

  let normalizedCurrentTime =
    Math.max(
      0,
      currentTime,
    );

  if (
    normalizedCurrentTime <= 0 &&
    duration > 0 &&
    progress !== undefined
  ) {
    const percentage =
      progress > 1
        ? progress / 100
        : progress;

    if (
      percentage >= 0 &&
      percentage <= 1
    ) {
      normalizedCurrentTime =
        duration *
        percentage;
    }
  }

  return {
    event,

    currentTime:
      normalizedCurrentTime,

    duration:
      Math.max(
        0,
        duration,
      ),

    mediaId,

    mediaType,

    season,

    episode,

    progress:
      progress !== undefined
        ? Math.max(
            0,
            progress,
          )
        : undefined,
  };
}

const PLAYER_ORIGINS = [
  "https://vidlink.pro",
  "https://embed.filmu.in",
  "https://vidsrc.in",
  "https://multiembed.mov",
  "https://www.nontongo.win",
  "https://vidcore.org",
  "https://vidsrcme.ru",
  "https://vidsrcme.su",
  "https://vidsrc.ir",
  "https://vidsrc-me.ru",
  "https://vidstuck.xyz",
  "https://player.videasy.to",
  "https://filmku.stream",
  "https://www.2embed.cc",
  "https://2embed.cc",
  "https://vidsrc.ru",
  "https://vidsrc.su",
  "https://vidsrc-me.ir",
] as const;

export type PlayerOrigin =
  (typeof PLAYER_ORIGINS)[number];

const PLAYER_ORIGIN_SET =
  new Set<string>(
    PLAYER_ORIGINS,
  );

export const playerAdapters =
  Object.fromEntries(
    PLAYER_ORIGINS.map(
      (origin) => [
        origin,
        {
          origin,
          parse:
            parseGenericPlayerMessage,
        },
      ],
    ),
  ) as AdapterMap;

export interface PlayerMediaMetadata {
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
  };

  saveHistory?: boolean;

  playerFrameRef?: RefObject<
    HTMLIFrameElement | null
  >;

  onPlay?: (
    data: UnifiedPlayerEventData,
  ) => void;

  onPause?: (
    data: UnifiedPlayerEventData,
  ) => void;

  onSeeked?: (
    data: UnifiedPlayerEventData,
  ) => void;

  onEnded?: (
    data: UnifiedPlayerEventData,
  ) => void;

  onTimeUpdate?: (
    data: UnifiedPlayerEventData,
  ) => void;
}

export function usePlayerEvents(
  options: UsePlayerEventsOptions = {},
) {
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

  const eventDataRef =
    useRef<UnifiedPlayerEventData | null>(
      null,
    );

  const metadataRef =
    useRef(metadata);

  const saveHistoryRef =
    useRef(saveHistory);

  const callbacksRef =
    useRef({
      onPlay,
      onPause,
      onSeeked,
      onEnded,
      onTimeUpdate,
    });

  const lastSavedPositionRef =
    useRef(0);

  const completionTriggeredRef =
    useRef(false);

  const completionMediaIdentityRef =
    useRef<string | null>(null);

  useEffect(() => {
    metadataRef.current =
      metadata;

    const identity = [
      metadata?.mediaType ?? "",
      metadata?.mediaId ?? "",
      metadata?.season ?? "",
      metadata?.episode ?? "",
    ].join(":");

    if (
      identity &&
      completionMediaIdentityRef.current !==
        identity
    ) {
      completionMediaIdentityRef.current =
        identity;

      completionTriggeredRef.current =
        false;

      lastSavedPositionRef.current =
        0;

      eventDataRef.current =
        null;
    }
  }, [
    metadata,
  ]);

  useEffect(() => {
    saveHistoryRef.current =
      saveHistory;
  }, [
    saveHistory,
  ]);

  useEffect(() => {
    callbacksRef.current = {
      onPlay,
      onPause,
      onSeeked,
      onEnded,
      onTimeUpdate,
    };
  }, [
    onPlay,
    onPause,
    onSeeked,
    onEnded,
    onTimeUpdate,
  ]);

  const saveLocalProgress =
    useCallback(
      (
        data: UnifiedPlayerEventData,
        completed = false,
      ) => {
        if (
          !saveHistoryRef.current
        ) {
          return;
        }

        const currentMetadata =
          metadataRef.current;

        const mediaId =
          Number(
            currentMetadata?.mediaId ??
              data.mediaId,
          );

        if (
          !Number.isFinite(
            mediaId,
          ) ||
          mediaId <= 0
        ) {
          return;
        }

        const mediaType =
          currentMetadata?.mediaType ??
          data.mediaType;

        const title =
          currentMetadata?.title;

        const backdropPath =
          currentMetadata?.backdrop_path;

        const releaseDate =
          currentMetadata?.release_date;

        const voteAverage =
          currentMetadata?.vote_average;

        if (
          !title ||
          backdropPath ===
            undefined ||
          releaseDate ===
            undefined ||
          voteAverage ===
            undefined
        ) {
          return;
        }

        const season =
          currentMetadata?.season ??
          data.season;

        const episode =
          currentMetadata?.episode ??
          data.episode;

        const currentTime =
          Number.isFinite(
            data.currentTime,
          )
            ? Math.max(
                0,
                data.currentTime,
              )
            : 0;

        const duration =
          Number.isFinite(
            data.duration,
          )
            ? Math.max(
                0,
                data.duration,
              )
            : 0;

        saveWatchProgress(
          {
            mediaId,
            mediaType,

            title,

            backdrop_path:
              backdropPath,

            poster_path:
              currentMetadata?.poster_path,

            release_date:
              releaseDate,

            vote_average:
              voteAverage,

            season,
            episode,
          },

          currentTime,
          duration,
          completed,
        );

        lastSavedPositionRef.current =
          currentTime;
      },
      [],
    );

  const flushProgress =
    useCallback(() => {
      const latest =
        eventDataRef.current;

      if (!latest) {
        return;
      }

      saveLocalProgress(
        latest,
        latest.event ===
          "ended",
      );
    }, [
      saveLocalProgress,
    ]);

  const getCurrentTime =
    useCallback(() => {
      return Math.max(
        0,
        eventDataRef.current
          ?.currentTime ?? 0,
      );
    }, []);

  const maybeSaveProgress =
    useCallback(
      (
        data: UnifiedPlayerEventData,
        force = false,
      ) => {
        if (
          !saveHistoryRef.current
        ) {
          return;
        }

        if (
          !force &&
          Math.abs(
            data.currentTime -
              lastSavedPositionRef.current,
          ) < 5
        ) {
          return;
        }

        saveLocalProgress(
          data,
        );
      },
      [
        saveLocalProgress,
      ],
    );

  useEffect(() => {
    const saveLatestProgress =
      () => {
        const latest =
          eventDataRef.current;

        if (!latest) {
          return;
        }

        saveLocalProgress(
          latest,
          latest.event ===
            "ended",
        );
      };

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "hidden"
        ) {
          saveLatestProgress();
        }
      };

    const handlePageHide =
      () => {
        saveLatestProgress();
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    window.addEventListener(
      "pagehide",
      handlePageHide,
    );

    return () => {
      saveLatestProgress();

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.removeEventListener(
        "pagehide",
        handlePageHide,
      );
    };
  }, [
    saveLocalProgress,
  ]);

  useEffect(() => {
    const handleMessage =
      (
        event: MessageEvent,
      ) => {
        const trustedOrigin =
          PLAYER_ORIGIN_SET.has(
            event.origin,
          );

        const activeFrame =
          playerFrameRef?.current;

        const activeFrameSource =
          Boolean(
            activeFrame &&
              event.source ===
                activeFrame.contentWindow,
          );

        if (
          !trustedOrigin &&
          !activeFrameSource
        ) {
          return;
        }

        const rawData =
          parseMaybeJson(
            event.data,
          );

        if (
          !isRecord(rawData)
        ) {
          return;
        }

        const adapter =
          trustedOrigin
            ? playerAdapters[
                event.origin
              ]
            : undefined;

        let parsed =
          adapter?.parse(
            rawData,
          ) ?? null;

        if (!parsed) {
          parsed =
            parseGenericPlayerMessage(
              rawData,
            );
        }

        if (!parsed) {
          return;
        }

        const currentMetadata =
          metadataRef.current;

        const normalized: UnifiedPlayerEventData =
          {
            ...parsed,

            mediaId:
              currentMetadata?.mediaId ??
              parsed.mediaId,

            mediaType:
              currentMetadata?.mediaType ??
              parsed.mediaType,

            season:
              currentMetadata?.season ??
              parsed.season,

            episode:
              currentMetadata?.episode ??
              parsed.episode,
          };

        eventDataRef.current =
          normalized;

        const callbacks =
          callbacksRef.current;

        switch (
          normalized.event
        ) {
          case "play":
            callbacks.onPlay?.(
              normalized,
            );

            maybeSaveProgress(
              normalized,
            );
            break;

          case "pause":
            callbacks.onPause?.(
              normalized,
            );

            maybeSaveProgress(
              normalized,
              true,
            );
            break;

          case "seeked":
            callbacks.onSeeked?.(
              normalized,
            );

            maybeSaveProgress(
              normalized,
              true,
            );
            break;

          case "timeupdate":
            callbacks.onTimeUpdate?.(
              normalized,
            );

            maybeSaveProgress(
              normalized,
            );
            break;

          case "ended":
            if (
              !completionTriggeredRef.current
            ) {
              completionTriggeredRef.current =
                true;

              saveLocalProgress(
                normalized,
                true,
              );

              callbacks.onEnded?.(
                normalized,
              );
            }
            break;
        }

        if (
          normalized.duration > 0 &&
          normalized.currentTime >=
            normalized.duration *
              COMPLETION_THRESHOLD &&
          !completionTriggeredRef.current
        ) {
          completionTriggeredRef.current =
            true;

          saveLocalProgress(
            normalized,
            true,
          );

          callbacks.onEnded?.(
            normalized,
          );
        }
      };

    window.addEventListener(
      "message",
      handleMessage,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleMessage,
      );
    };
  }, [
    maybeSaveProgress,
    playerFrameRef,
    saveLocalProgress,
  ]);

  return {
    getCurrentTime,
    flushProgress,
  };
  }
