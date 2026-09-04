import { ContentType } from "@/types";
import {
  getHistoryKey,
  saveWatchProgress,
} from "@/utils/localStorage";
import { useEffect, useRef } from "react";

export type PlayerEventType =
  | "play"
  | "pause"
  | "seeked"
  | "ended"
  | "timeupdate";

export interface BasePlayerEventEnvelope<T> {
  type: "PLAYER_EVENT" | "MEDIA_DATA";
  data: T;
}

export interface VidlinkEventData {
  event: PlayerEventType;
  currentTime: number;
  duration: number;
  mtmdbId: number;
  mediaType: ContentType;
  season?: number;
  episode?: number;
}

export type VidlinkPlayerMessage =
  BasePlayerEventEnvelope<VidlinkEventData>;

export interface VidkingEventData {
  event: PlayerEventType;
  currentTime: number;
  duration: number;
  id: string | number;
  mediaType: ContentType;
  season?: number;
  episode?: number;
  progress?: number;
}

export type VidkingPlayerMessage =
  BasePlayerEventEnvelope<VidkingEventData>;

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
  RawMessage extends BasePlayerEventEnvelope<any>,
> {
  origin: `https://${string}`;

  parse: (
    raw: RawMessage,
  ) => UnifiedPlayerEventData | null;
}

export type AdapterMap =
  Record<string, PlayerAdapter<any>>;

export const playerAdapters = {
  vidlink: {
    origin: "https://vidlink.pro",

    parse: (raw) => {
      if (raw.type !== "PLAYER_EVENT") {
        return null;
      }

      const data = raw.data;

      return {
        ...data,
        mediaId: data.mtmdbId,
      };
    },
  } satisfies PlayerAdapter<VidlinkPlayerMessage>,

  vidking: {
    origin: "https://www.vidking.net",

    parse: (raw) => {
      if (raw.type !== "PLAYER_EVENT") {
        return null;
      }

      const data = raw.data;

      return {
        ...data,
        mediaId: data.id,
      };
    },
  } satisfies PlayerAdapter<VidkingPlayerMessage>,
} as const satisfies AdapterMap;

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
    useRef<UnifiedPlayerEventData | null>(null);

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
    saveHistoryRef.current = saveHistory;
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

  useEffect(() => {
    const saveLatestProgress = () => {
      const latestEvent =
        eventDataRef.current;

      if (!latestEvent) return;

      if (
        latestEvent.event === "ended"
      ) {
        saveLocalProgress(
          latestEvent,
          true,
        );

        return;
      }

      saveLocalProgress(latestEvent);
    };

    const handleVisibilityChange = () => {
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
          callbacksRef.current.onPlay?.(
            parsed,
          );
          break;

        case "pause":
          callbacksRef.current.onPause?.(
            parsed,
          );

          maybeSaveProgress(
            parsed,
            true,
          );

          break;

        case "seeked":
          callbacksRef.current.onSeeked?.(
            parsed,
          );

          maybeSaveProgress(
            parsed,
            true,
          );

          break;

        case "timeupdate":
          callbacksRef.current.onTimeUpdate?.(
            parsed,
          );

          maybeSaveProgress(parsed);

          break;

        case "ended":
          saveLocalProgress(
            parsed,
            true,
          );

          callbacksRef.current.onEnded?.(
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
  }, []);

  return {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    lastEvent:
      null as PlayerEventType | null,
  };
        }
