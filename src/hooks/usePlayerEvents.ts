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
  data: T;
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

function isPlayerEvent(
  value: unknown,
): value is PlayerEventType {
  return (
    typeof value === "string" &&
    SUPPORTED_EVENTS.includes(
      value as PlayerEventType,
    )
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

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function unwrapEventData(
  raw: BasePlayerEventEnvelope<any>,
): any {
  let data = raw?.data;

  if (
    typeof data === "string"
  ) {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  if (
    data.data &&
    typeof data.data === "object" &&
    !data.event &&
    !data.eventType &&
    !data.action
  ) {
    return data.data;
  }

  return data;
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

  const eventRaw = firstDefined(
    data.event,
    data.eventType,
    data.event_type,
    data.action,
    data.name,
  );

  const event =
    typeof eventRaw === "string"
      ? eventRaw.toLowerCase()
      : undefined;

  if (!isPlayerEvent(event)) {
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
    );

  if (
    mediaId === undefined ||
    mediaId === null
  ) {
    return null;
  }

  const currentTime =
    toNumber(
      firstDefined(
        data.currentTime,
        data.current_time,
        data.position,
        data.current,
        data.time,
        data.seconds,
      ),
    ) ?? 0;

  const duration =
    toNumber(
      firstDefined(
        data.duration,
        data.totalDuration,
        data.total_duration,
        data.length,
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
    mediaTypeRaw === "movie" ||
    mediaTypeRaw === "tv"
      ? mediaTypeRaw
      : undefined;

  if (!mediaType) {
    return null;
  }

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

  return {
    event,

    currentTime: Math.max(
      0,
      currentTime,
    ),

    duration: Math.max(
      0,
      duration,
    ),

    mediaId,

    mediaType,

    season,

    episode,

    progress:
      progress !== undefined
        ? Math.max(0, progress)
        : undefined,
  };
}

/*
 * These are the actual external iframe origins
 * currently used by players.ts.
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

  const callbacksRef = useRef({
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

    /*
     * Reset the cached event when the
     * actual media/episode changes.
     */
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
          !Number.isFinite(mediaId) ||
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
          backdropPath === undefined ||
          releaseDate === undefined ||
          voteAverage === undefined
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
        latest.event === "ended",
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

        saveLocalProgress(data);
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
          latest.event === "ended",
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

    const handleBeforeUnload =
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

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
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

      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
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

        const activeFrame =
          playerFrameRef?.current;

        if (
          activeFrame &&
          event.source !==
            activeFrame.contentWindow
        ) {
          return;
        }

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
          adapter.parse(rawData);

        if (!parsed) {
          return;
        }

        /*
         * Always trust the page metadata for
         * identity when it is available.
         *
         * This prevents a provider from sending
         * incomplete metadata and causing progress
         * to be written under the wrong episode.
         */
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
    playerFrameRef,
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
