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

/*
 * Consider an item completed once playback reaches 90%.
 *
 * This is primarily a fallback for providers that do not
 * reliably send an "ended" event.
 */
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

/*
 * Current RyuFlixx providers.
 *
 * VidKing is intentionally NOT included.
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

  /*
   * Ref to the iframe currently controlled by
   * WatchPlayer.
   */
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

  /*
   * Prevent the completion threshold from
   * firing more than once for the same
   * movie/episode.
   */
  const completionTriggeredRef =
    useRef(false);

  /*
   * Track which movie/episode the completion
   * state belongs to.
   *
   * Next.js can keep the same player component
   * mounted while navigating between episodes.
   */
  const completionMediaIdentityRef =
    useRef<string | null>(null);

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

  /*
   * Save progress locally.
   */
  const saveLocalProgress = useCallback(
    (
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
        data.season ??
        currentMetadata?.season;

      const episode =
        data.episode ??
        currentMetadata?.episode;

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

        data.currentTime,
        data.duration,
        completed,
      );

      lastSavedPositionRef.current =
        data.currentTime;
    },
    [],
  );

  /*
   * Force-save the latest known event.
   */
  const flushProgress = useCallback(() => {
    const latest =
      eventDataRef.current;

    if (!latest) {
      return;
    }

    saveLocalProgress(
      latest,
      latest.event === "ended",
    );
  }, [saveLocalProgress]);

  /*
   * Current playback position.
   */
  const getCurrentTime = useCallback(() => {
    const latest =
      eventDataRef.current;

    if (!latest) {
      return 0;
    }

    return Math.max(
      0,
      latest.currentTime,
    );
  }, []);

  /*
   * Save timeupdate events periodically.
   */
  const maybeSaveProgress = useCallback(
    (
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
    },
    [saveLocalProgress],
  );

  /*
   * Save when the page becomes hidden
   * or closes.
   */
  useEffect(() => {
    const saveLatestProgress = () => {
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
  }, [saveLocalProgress]);

  /*
   * Listen for PLAYER_EVENT messages.
   */
  useEffect(() => {
    const handleMessage = (
      event: MessageEvent,
    ) => {
      /*
       * Only accept messages from one of
       * the providers we actually use.
       */
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
       * Make sure the message came from
       * the active iframe.
       */
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

      /*
       * ----------------------------------------------------
       * MEDIA / EPISODE IDENTITY RESET
       * ----------------------------------------------------
       *
       * The same player component can survive navigation
       * from one episode to another.
       *
       * If episode 1 reaches 90%, completionTriggeredRef
       * becomes true. Without resetting it, episode 2
       * could never trigger its own completion callback.
       *
       * The identity includes:
       *
       *   media type
       *   media ID
       *   season
       *   episode
       *
       * Therefore every distinct movie or episode gets
       * its own completion state.
       */
      const mediaIdentity = [
        parsed.mediaType,
        parsed.mediaId,
        parsed.season ?? "",
        parsed.episode ?? "",
      ].join(":");

      if (
        completionMediaIdentityRef.current !==
          null &&
        completionMediaIdentityRef.current !==
          mediaIdentity
      ) {
        completionTriggeredRef.current =
          false;

        /*
         * A new movie/episode should start
         * with its own progress baseline.
         */
        lastSavedPositionRef.current =
          0;
      }

      completionMediaIdentityRef.current =
        mediaIdentity;

      eventDataRef.current =
        parsed;

      /*
       * ----------------------------------------------------
       * COMPLETION THRESHOLD
       * ----------------------------------------------------
       *
       * Providers sometimes fail to emit "ended".
       *
       * When a timeupdate gives us a real duration and
       * playback reaches 90%, mark the item completed
       * and invoke the exact same callback used by
       * a genuine "ended" event.
       *
       * We deliberately only trigger this on timeupdate,
       * so simply seeking/pause won't accidentally finish
       * an episode.
       */
      if (
        parsed.event ===
        "timeupdate"
      ) {
        let progressRatio = 0;

        if (parsed.duration > 0) {
          progressRatio =
            parsed.currentTime /
            parsed.duration;
        } else if (
          typeof parsed.progress ===
          "number"
        ) {
          /*
           * Providers may report progress as either:
           *
           *   0.0 - 1.0
           *
           * or
           *
           *   0 - 100
           */
          progressRatio =
            parsed.progress > 1
              ? parsed.progress / 100
              : parsed.progress;
        }

        if (
          progressRatio >=
            COMPLETION_THRESHOLD &&
          !completionTriggeredRef.current
        ) {
          completionTriggeredRef.current =
            true;

          /*
           * Save completed=true BEFORE
           * triggering navigation.
           */
          saveLocalProgress(
            parsed,
            true,
          );

          /*
           * Reuse the existing onEnded
           * callback. The TV player already
           * contains the next-episode logic.
           */
          callbacksRef.current
            .onEnded?.(parsed);
        }
      }

      /*
       * Real provider ended event.
       */
      if (
        parsed.event === "ended"
      ) {
        if (
          !completionTriggeredRef.current
        ) {
          completionTriggeredRef.current =
            true;

          saveLocalProgress(
            parsed,
            true,
          );

          callbacksRef.current
            .onEnded?.(parsed);
        }

        return;
      }

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
      eventDataRef.current?.event ===
      "play",

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
