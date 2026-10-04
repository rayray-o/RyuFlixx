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

const SAVE_DISTANCE_SECONDS = 2;

const COMPLETION_THRESHOLD = 0.9;

const SUPPORTED_EVENTS: PlayerEventType[] = [
  "play",
  "pause",
  "seeked",
  "ended",
  "timeupdate",
];

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

function unwrapData(
  raw: unknown,
): Record<string, any> | null {
  let current =
    parseMaybeJson(raw);

  if (!isRecord(current)) {
    return null;
  }

  for (
    let depth = 0;
    depth < 6;
    depth += 1
  ) {
    if (
      !isRecord(current.data)
    ) {
      break;
    }

    current =
      parseMaybeJson(
        current.data,
      );

    if (!isRecord(current)) {
      return null;
    }
  }

  return current;
}

function normalizeEvent(
  value: unknown,
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
    normalized === "seek" ||
    normalized === "seeked"
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
    SUPPORTED_EVENTS.includes(
      normalized as PlayerEventType,
    )
  ) {
    return normalized as PlayerEventType;
  }

  return undefined;
}

function normalizeTiming(
  currentTime: number,
  duration: number,
  progress?: number,
) {
  let time =
    Math.max(
      0,
      currentTime,
    );

  let safeDuration =
    Math.max(
      0,
      duration,
    );

  if (
    time <= 0 &&
    safeDuration > 0 &&
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
      time =
        safeDuration *
        percentage;
    }
  }

  if (
    safeDuration > 0
  ) {
    time =
      Math.min(
        time,
        safeDuration,
      );
  }

  return {
    currentTime: time,
    duration: safeDuration,
  };
}

function parseGenericPlayerMessage(
  raw: Record<string, any>,
): UnifiedPlayerEventData | null {
  const root =
    parseMaybeJson(raw);

  if (!isRecord(root)) {
    return null;
  }

  const data =
    unwrapData(root);

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

  const progressObject =
    isRecord(data.progress)
      ? data.progress
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
        data.watched,
        data.player_progress,
        value?.currentTime,
        value?.current_time,
        value?.position,
        value?.seconds,
        value?.watched,
        progressObject?.watched,
        progressObject?.currentTime,
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
        progressObject?.duration,
      ),
    ) ?? 0;

  const progress =
    toNumber(
      firstDefined(
        typeof data.progress ===
          "number"
          ? data.progress
          : undefined,
        data.percent,
        data.percentage,
        value?.progress,
        value?.percent,
        value?.percentage,
        progressObject?.percentage,
      ),
    );

  const event =
    normalizeEvent(
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
      ),
    ) ??
    (
      currentTime > 0 ||
      duration > 0 ||
      progress !== undefined
        ? "timeupdate"
        : undefined
    );

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

  const timing =
    normalizeTiming(
      currentTime,
      duration,
      progress,
    );

  return {
    event,

    currentTime:
      timing.currentTime,

    duration:
      timing.duration,

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

/*
 * VidLink:
 *
 * MEDIA_DATA:
 * {
 *   id,
 *   type,
 *   progress: {
 *     watched,
 *     duration
 *   },
 *   ...
 * }
 *
 * PLAYER_EVENT:
 * {
 *   event,
 *   currentTime,
 *   duration,
 *   ...
 * }
 */
function parseVidLinkMessage(
  raw: Record<string, any>,
): UnifiedPlayerEventData | null {
  const root =
    parseMaybeJson(raw);

  if (!isRecord(root)) {
    return null;
  }

  if (
    root.type ===
    "MEDIA_DATA"
  ) {
    const data =
      unwrapData(root);

    if (!data) {
      return null;
    }

    const progress =
      isRecord(data.progress)
        ? data.progress
        : undefined;

    const currentTime =
      toNumber(
        progress?.watched,
      ) ?? 0;

    const duration =
      toNumber(
        progress?.duration,
      ) ?? 0;

    if (
      currentTime <= 0 &&
      duration <= 0
    ) {
      return null;
    }

    return {
      event:
        "timeupdate",

      currentTime,

      duration,

      mediaId:
        firstDefined(
          data.id,
          data.tmdbId,
          data.tmdb_id,
        ) ?? 0,

      mediaType:
        data.type === "tv"
          ? "tv"
          : "movie",

      season:
        toNumber(
          firstDefined(
            data.last_season_watched,
            data.season,
          ),
        ),

      episode:
        toNumber(
          firstDefined(
            data.last_episode_watched,
            data.episode,
          ),
        ),
    };
  }

  return parseGenericPlayerMessage(
    root,
  );
}

/*
 * FilmU:
 *
 * SYNC_HISTORY
 * FILMU_PLAYER_EVENT
 */
function parseFilmUMessage(
  raw: Record<string, any>,
): UnifiedPlayerEventData | null {
  const root =
    parseMaybeJson(raw);

  if (!isRecord(root)) {
    return null;
  }

  const data =
    unwrapData(root);

  if (!data) {
    return null;
  }

  if (
    root.type ===
    "SYNC_HISTORY"
  ) {
    const currentTime =
      toNumber(
        data.watched,
      ) ?? 0;

    const duration =
      toNumber(
        data.duration,
      ) ?? 0;

    return {
      event:
        "timeupdate",

      currentTime,

      duration,

      mediaId:
        firstDefined(
          data.media_id,
          data.tmdbId,
          data.id,
        ) ?? 0,

      mediaType:
        data.media_type === "tv"
          ? "tv"
          : "movie",

      season:
        toNumber(
          data.season,
        ),

      episode:
        toNumber(
          data.episode,
        ),
    };
  }

  if (
    root.type ===
    "FILMU_PLAYER_EVENT"
  ) {
    const event =
      normalizeEvent(
        data.event,
      );

    if (!event) {
      return null;
    }

    return {
      event,

      currentTime:
        toNumber(
          data.currentTime,
        ) ?? 0,

      duration:
        toNumber(
          data.duration,
        ) ?? 0,

      mediaId:
        firstDefined(
          data.tmdbId,
          data.media_id,
        ) ?? 0,

      mediaType:
        data.mediaType === "tv"
          ? "tv"
          : "movie",

      season:
        toNumber(
          data.season,
        ),

      episode:
        toNumber(
          data.episode,
        ),
    };
  }

  return parseGenericPlayerMessage(
    root,
  );
}

/*
 * VidRift:
 *
 * vidrift:progress
 * vidrift:ended
 */
function parseVidRiftMessage(
  raw: Record<string, any>,
): UnifiedPlayerEventData | null {
  const root =
    parseMaybeJson(raw);

  if (!isRecord(root)) {
    return null;
  }

  if (
    root.type !==
      "vidrift:progress" &&
    root.type !==
      "vidrift:ended"
  ) {
    return null;
  }

  const currentTime =
    toNumber(
      root.currentTime,
    ) ?? 0;

  const duration =
    toNumber(
      root.duration,
    ) ?? 0;

  return {
    event:
      root.type ===
      "vidrift:ended"
        ? "ended"
        : "timeupdate",

    currentTime,

    duration,

    mediaId:
      firstDefined(
        root.tmdbId,
        root.tmdb_id,
        root.mediaId,
      ) ?? 0,

    mediaType:
      root.mediaType === "tv"
        ? "tv"
        : "movie",

    season:
      toNumber(
        root.season,
      ),

    episode:
      toNumber(
        root.episode,
      ),
  };
}

const PLAYER_ORIGINS = [
  "https://vidlink.pro",

  "https://embed.filmu.in",

  "https://embed.vidrift.net",
  "https://embed.vidrift.in",

  "https://vidsrc.in",
  "https://vidsrc.ru",
  "https://vidsrc.su",
  "https://vidsrc.ir",
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

  "https://player.videasy.to",
] as const;

export type PlayerOrigin =
  (typeof PLAYER_ORIGINS)[number];

const PLAYER_ORIGIN_SET =
  new Set<string>(
    PLAYER_ORIGINS,
  );

export const playerAdapters =
  Object.fromEntries([
    [
      "https://vidlink.pro",
      {
        origin:
          "https://vidlink.pro",
        parse:
          parseVidLinkMessage,
      },
    ],

    [
      "https://embed.filmu.in",
      {
        origin:
          "https://embed.filmu.in",
        parse:
          parseFilmUMessage,
      },
    ],

    [
      "https://embed.vidrift.net",
      {
        origin:
          "https://embed.vidrift.net",
        parse:
          parseVidRiftMessage,
      },
    ],

    [
      "https://embed.vidrift.in",
      {
        origin:
          "https://embed.vidrift.in",
        parse:
          parseVidRiftMessage,
      },
    ],

    ...[
      "https://vidsrc.in",
      "https://vidsrc.ru",
      "https://vidsrc.su",
      "https://vidsrc.ir",
      "https://vidsrcme.ru",
      "https://vidsrcme.su",
      "https://vidsrc-me.ru",
      "https://vidsrc-me.ir",
    ].map(
      (origin) => [
        origin,
        {
          origin,
          parse:
            parseGenericPlayerMessage,
        },
      ],
    ),

    ...[
      "https://multiembed.mov",
      "https://www.nontongo.win",
      "https://vidcore.org",
      "https://vidcore.io",
      "https://filmku.stream",
      "https://www.2embed.cc",
      "https://2embed.cc",
      "https://vidstuck.xyz",
      "https://player.videasy.to",
    ].map(
      (origin) => [
        origin,
        {
          origin,
          parse:
            parseGenericPlayerMessage,
        },
      ],
    ),
  ]) as AdapterMap;

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

  const lastDurationRef =
    useRef(0);

  const completionTriggeredRef =
    useRef(false);

  const completionIdentityRef =
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
      completionIdentityRef.current !==
        identity
    ) {
      completionIdentityRef.current =
        identity;

      completionTriggeredRef.current =
        false;

      lastSavedPositionRef.current =
        0;

      lastDurationRef.current =
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
          ) &&
          data.duration > 0
            ? data.duration
            : lastDurationRef.current;

        if (
          duration > 0
        ) {
          lastDurationRef.current =
            duration;
        }

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
          ) <
            SAVE_DISTANCE_SECONDS
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
    const saveLatest =
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

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          "hidden"
        ) {
          saveLatest();
        }
      };

    const handlePageHide =
      () => {
        saveLatest();
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    window.addEventListener(
      "pagehide",
      handlePageHide,
    );

    return () => {
      saveLatest();

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
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
        if (
          !PLAYER_ORIGIN_SET.has(
            event.origin,
          )
        ) {
          return;
        }

        const activeFrame =
          playerFrameRef?.current;

        /*
         * Only accept events from the iframe
         * that is actually playing right now.
         *
         * This prevents an old iframe/provider
         * from overwriting the new server's
         * position.
         */
        if (
          activeFrame &&
          event.source !==
            activeFrame.contentWindow
        ) {
          return;
        }

        const raw =
          parseMaybeJson(
            event.data,
          );

        if (!isRecord(raw)) {
          return;
        }

        const adapter =
          playerAdapters[
            event.origin
          ];

        let parsed =
          adapter?.parse(
            raw,
          ) ?? null;

        if (!parsed) {
          parsed =
            parseGenericPlayerMessage(
              raw,
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

        if (
          normalized.mediaType !==
            "movie" &&
          normalized.mediaType !==
            "tv"
        ) {
          return;
        }

        eventDataRef.current =
          normalized;

        if (
          normalized.duration > 0
        ) {
          lastDurationRef.current =
            normalized.duration;
        }

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
