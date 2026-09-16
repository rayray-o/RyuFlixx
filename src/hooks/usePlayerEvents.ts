"use client";

import { ContentType } from "@/types";
import {
  saveWatchProgress,
} from "@/utils/localStorage";
import {
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
    normalized === "playing"
  ) {
    return "play";
  }

  if (
    normalized === "progress"
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
): any {
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

function unwrapEventData(
  raw: BasePlayerEventEnvelope<any>,
): any {
  let data =
    parseMaybeJson(raw?.data);

  /*
   * Some providers send the actual event
   * directly on event.data rather than inside
   * a "data" property.
   */
  if (
    !data ||
    typeof data !== "object"
  ) {
    data =
      parseMaybeJson(raw);
  }

  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  /*
   * Support:
   *
   * { data: { ... } }
   * { data: { data: { ... } } }
   *
   * without requiring a particular envelope.
   */
  let current = data;

  for (
    let depth = 0;
    depth < 3;
    depth += 1
  ) {
    if (
      current.data === undefined
    ) {
      break;
    }

    const nested =
      parseMaybeJson(
        current.data,
      );

    if (
      !nested ||
      typeof nested !== "object"
    ) {
      break;
    }

    current = nested;
  }

  return current;
}

function parseGenericPlayerMessage(
  raw: BasePlayerEventEnvelope<any>,
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

  const event =
    normalizeEvent(
      firstDefined(
        data.event,
        data.eventType,
        data.event_type,
        data.action,
        data.name,
        data.type,
        raw.type,
      ),
    );

  if (!event) {
    return null;
  }

  /*
   * Provider identity is optional.
   *
   * RyuFlix already knows the authoritative
   * movie/TV identity from the current page.
   */
  const mediaId =
    firstDefined(
      data.tmdbId,
      data.tmdb_id,
      data.mediaId,
      data.media_id,
      data.id,
      data.videoId,
      data.video_id,
      data.mtmdbId,
    ) ?? 0;

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
      ),
    ) ?? 0;

  const progress =
    toNumber(
      firstDefined(
        data.progress,
        data.percent,
        data.percentage,
      ),
    );

  const mediaTypeRaw =
    firstDefined(
      data.mediaType,
      data.media_type,
      data.contentType,
      data.content_type,
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
      ),
    );

  const episode =
    toNumber(
      firstDefined(
        data.episode,
        data.episodeNumber,
        data.episode_number,
        data.e,
      ),
    );

  /*
   * Don't accept completely empty messages.
   * A recognized playback event needs either
   * timing information or an ended/play/pause
   * signal.
   */
  const hasTimingData =
    currentTime > 0 ||
    duration > 0 ||
    progress !== undefined;

  if (
    !hasTimingData &&
    event === "timeupdate"
  ) {
    return null;
  }

  return {
    event,

    currentTime:
      Math.max(
        0,
        currentTime,
      ),

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

/*
 * These are the actual external iframe
 * origins currently used by players.ts.
 */
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

  playerFrameRef?: React.RefObject<
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
      (event: MessageEvent) => {
        const adapter =
          Object.values(
            playerAdapters,
          ).find(
            (candidate) =>
              candidate.origin ===
              event.origin,
          );

        if (!adapter) {
          return;
        }

        /*
         * The origin allowlist above is the
         * security boundary.
         *
         * Do NOT additionally require
         * event.source === outer iframe.contentWindow.
         *
         * A provider may have its actual player
         * inside another nested browsing context,
         * in which case the nested window is the
         * sender of the postMessage.
         */
        let rawData: any;

        try {
          rawData =
            typeof event.data ===
            "string"
              ? JSON.parse(
                  event.data,
                )
              : event.data;
        } catch {
          return;
        }

        if (
          !rawData ||
          typeof rawData !==
            "object"
        ) {
          return;
        }

        const parsed =
          adapter.parse(
            rawData,
          );

        if (!parsed) {
          return;
        }

        const currentMetadata =
          metadataRef.current;

        /*
         * The RyuFlix page owns the identity.
         * Provider metadata is only supplemental.
         */
        const normalized:
          UnifiedPlayerEventData = {
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

        const mediaIdentity = [
          normalized.mediaType,
          normalized.mediaId,
          normalized.season ?? "",
          normalized.episode ?? "",
        ].join(":");

        if (
          completionMediaIdentityRef.current !==
            null &&
          completionMediaIdentityRef.current !==
            mediaIdentity
        ) {
          completionTriggeredRef.current =
            false;

          lastSavedPositionRef.current =
            0;
        }

        completionMediaIdentityRef.current =
          mediaIdentity;

        eventDataRef.current =
          normalized;

        if (
          normalized.event ===
          "timeupdate"
        ) {
          let progressRatio =
            0;

          if (
            normalized.duration >
            0
          ) {
            progressRatio =
              normalized.currentTime /
              normalized.duration;
          } else if (
            typeof normalized.progress ===
            "number"
          ) {
            progressRatio =
              normalized.progress >
              1
                ? normalized.progress /
                  100
                : normalized.progress;
          }

          if (
            progressRatio >=
              COMPLETION_THRESHOLD &&
            !completionTriggeredRef.current
          ) {
            completionTriggeredRef.current =
              true;

            saveLocalProgress(
              normalized,
              true,
            );

            callbacksRef.current
              .onEnded?.(
                normalized,
              );
          }
        }

        if (
          normalized.event ===
          "ended"
        ) {
          if (
            !completionTriggeredRef.current
          ) {
            completionTriggeredRef.current =
              true;

            saveLocalProgress(
              normalized,
              true,
            );

            callbacksRef.current
              .onEnded?.(
                normalized,
              );
          }

          return;
        }

        switch (
          normalized.event
        ) {
          case "play":
            callbacksRef.current
              .onPlay?.(
                normalized,
              );

            /*
             * If this is the first useful
             * position we have received,
             * create the history record.
             */
            if (
              normalized.currentTime >
              0
            ) {
              maybeSaveProgress(
                normalized,
                true,
              );
            }

            break;

          case "pause":
            callbacksRef.current
              .onPause?.(
                normalized,
              );

            maybeSaveProgress(
              normalized,
              true,
            );

            break;

          case "seeked":
            callbacksRef.current
              .onSeeked?.(
                normalized,
              );

            maybeSaveProgress(
              normalized,
              true,
            );

            break;

          case "timeupdate":
            callbacksRef.current
              .onTimeUpdate?.(
                normalized,
              );

            maybeSaveProgress(
              normalized,
            );

            break;
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
    saveLocalProgress,
  ]);

  return {
    isPlaying:
      eventDataRef.current
        ?.event === "play",

    currentTime:
      eventDataRef.current
        ?.currentTime ?? 0,

    duration:
      eventDataRef.current
        ?.duration ?? 0,

    lastEvent:
      eventDataRef.current
        ?.event ?? null,

    getCurrentTime,

    flushProgress,
  };
}
