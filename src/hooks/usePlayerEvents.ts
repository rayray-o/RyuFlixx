"use client";

import { ContentType } from "@/types";
import { saveWatchProgress } from "@/utils/localStorage";
import { useEffect, useRef } from "react";

export type PlayerEventType =
  | "play"
  | "pause"
  | "seeked"
  | "ended"
  | "timeupdate";

export interface BasePlayerEventEnvelope<T = any> {
  type: "PLAYER_EVENT" | "MEDIA_DATA" | string;
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

/**
 * Normalizes PLAYER_EVENT messages from the
 * providers currently used by RyuFlixx.
 */
function parseGenericPlayerMessage(
  raw: BasePlayerEventEnvelope<any>,
): UnifiedPlayerEventData | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    raw.type !== "PLAYER_EVENT"
  ) {
    return null;
  }

  const data = raw.data;

  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const event = firstDefined<string>(
    data.event,
    data.eventType,
    data.action,
  );

  if (!isPlayerEvent(event)) {
    return null;
  }

  const mediaId = firstDefined<
    string | number
  >(
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

  const currentTimeRaw =
    firstDefined<number>(
      data.currentTime,
      data.current_time,
      data.position,
      data.time,
    );

  const durationRaw =
    firstDefined<number>(
      data.duration,
      data.totalDuration,
      data.total_duration,
    );

  const progressRaw =
    firstDefined<number>(
      data.progress,
      data.percent,
    );

  const currentTime =
    typeof currentTimeRaw === "number"
      ? currentTimeRaw
      : 0;

  const duration =
    typeof durationRaw === "number"
      ? durationRaw
      : 0;

  const mediaType =
    firstDefined<ContentType>(
      data.mediaType,
      data.media_type,
      data.type === "movie"
        ? "movie"
        : data.type === "tv"
          ? "tv"
          : undefined,
    );

  if (!mediaType) {
    return null;
  }

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

    season:
      typeof data.season === "number"
        ? data.season
        : undefined,

    episode:
      typeof data.episode === "number"
        ? data.episode
        : undefined,

    progress:
      typeof progressRaw === "number"
        ? progressRaw
        : undefined,
  };
}

/**
 * Providers currently present in src/utils/players.ts.
 *
 * VidKing has intentionally been removed.
 */
const PLAYER_ORIGINS = [
  "https://vidlink.pro",
  "https://embed.filmu.in",

  "https://www.2embed.cc",
  "https://2embed.cc",

  "https://multiembed.mov",

  "https://www.nontongo.win",

  "https://vidcore.org",

  "https://vidsrcme.ru",
  "https://vidsrcme.su",

  "https://vidsrc.ir",
  "https://vidsrc-me.ru",

  "https://vsembed.ru",

  "https://player.videasy.to",

  "https://filmku.stream",

  "https://vidsrc.ru",
  "https://vidsrc.su",
  "https://vidsrc-me.ir",
] as const;

export type PlayerOrigin =
  (typeof PLAYER_ORIGINS)[number];

/**
 * Generate adapters for every current provider.
 *
 * AdapterMap deliberately uses string keys so
 * Object.fromEntries remains TypeScript-safe.
 */
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

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  useEffect(() => {
    saveHistoryRef.current =
      saveHistory;
  }, [saveHistory]);

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

  /**
   * Save the current normalized playback state.
   */
  const saveLocalProgress = (
    data: UnifiedPlayerEventData,
    completed = false,
  ) => {
    if (!saveHistoryRef.current) {
      return;
    }

    const currentMetadata =
      metadataRef.current;

    const mediaId =
      Number(data.mediaId);

    if (
      !Number.isFinite(mediaId) ||
      mediaId <= 0
    ) {
      return;
    }

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
      data.season ??
      currentMetadata?.season;

    const episode =
      data.episode ??
      currentMetadata?.episode;

    saveWatchProgress(
      {
        mediaId,

        mediaType:
          currentMetadata?.mediaType ??
          data.mediaType,

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
      data.currentTime,
      data.duration,
      completed,
    );

    lastSavedPositionRef.current =
      data.currentTime;
  };

  /**
   * Normal timeupdate saves are throttled.
   * Important events such as pause and seek
   * are saved immediately.
   */
  const maybeSaveProgress = (
    data: UnifiedPlayerEventData,
    force = false,
  ) => {
    if (!saveHistoryRef.current) {
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
  };

  /**
   * Save the latest known playback state when
   * the page/tab becomes hidden or unloads.
   */
  useEffect(() => {
    const saveLatestProgress = () => {
      const latestEvent =
        eventDataRef.current;

      if (!latestEvent) {
        return;
      }

      if (
        latestEvent.event === "ended"
      ) {
        saveLocalProgress(
          latestEvent,
          true,
        );

        return;
      }

      saveLocalProgress(
        latestEvent,
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

    const handleBeforeUnload = () => {
      saveLatestProgress();
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
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
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, []);

  /**
   * Listen for playback events coming from
   * the embedded player iframes.
   */
  useEffect(() => {
    const handleMessage = (
      event: MessageEvent,
    ) => {
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

      let rawData: any;

      try {
        rawData =
          typeof event.data ===
          "string"
            ? JSON.parse(event.data)
            : event.data;
      } catch {
        return;
      }

      if (
        !rawData ||
        typeof rawData !== "object"
      ) {
        return;
      }

      const parsed =
        adapter.parse(rawData);

      if (!parsed) {
        return;
      }

      eventDataRef.current =
        parsed;

      switch (parsed.event) {
        case "play":
          callbacksRef.current
            .onPlay?.(parsed);
          break;

        case "pause":
          callbacksRef.current
            .onPause?.(parsed);

          maybeSaveProgress(
            parsed,
            true,
          );
          break;

        case "seeked":
          callbacksRef.current
            .onSeeked?.(parsed);

          maybeSaveProgress(
            parsed,
            true,
          );
          break;

        case "timeupdate":
          callbacksRef.current
            .onTimeUpdate?.(parsed);

          maybeSaveProgress(
            parsed,
          );
          break;

        case "ended":
          saveLocalProgress(
            parsed,
            true,
          );

          callbacksRef.current
            .onEnded?.(parsed);
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
  }, []);

  return {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    lastEvent:
      null as PlayerEventType | null,
  };
            }
