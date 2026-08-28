import { syncHistory } from "@/actions/histories";
import { ContentType } from "@/types";
import { diff } from "@/utils/helpers";
import { useDocumentVisibility } from "@mantine/hooks";
import { useEffect, useRef } from "react";
import useSupabaseUser from "./useSupabaseUser";

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

      const d = raw.data;

      return {
        ...d,
        mediaId: d.mtmdbId,
      };
    },
  } satisfies PlayerAdapter<VidlinkPlayerMessage>,

  vidking: {
    origin: "https://www.vidking.net",

    parse: (raw) => {
      if (raw.type !== "PLAYER_EVENT") {
        return null;
      }

      const d = raw.data;

      return {
        ...d,
        mediaId: d.id,
      };
    },
  } satisfies PlayerAdapter<VidkingPlayerMessage>,
} as const satisfies AdapterMap;

export interface UsePlayerEventsOptions {
  metadata?: {
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
  const { data: user } = useSupabaseUser();
  const documentState = useDocumentVisibility();

  const {
    metadata,
    saveHistory,
    onPlay,
    onPause,
    onSeeked,
    onEnded,
    onTimeUpdate,
  } = options;

  /*
   * IMPORTANT:
   *
   * This hook intentionally keeps player state in refs.
   *
   * MoviePlayer does not consume the returned state, so
   * using useState here would cause unnecessary React
   * renders whenever the embedded player sends events.
   */

  const eventDataRef =
    useRef<UnifiedPlayerEventData | null>(null);

  const lastCurrentTimeRef = useRef(0);

  const metadataRef = useRef(metadata);
  const saveHistoryRef = useRef(saveHistory);
  const userRef = useRef(user);

  const callbacksRef = useRef({
    onPlay,
    onPause,
    onSeeked,
    onEnded,
    onTimeUpdate,
  });

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  useEffect(() => {
    saveHistoryRef.current = saveHistory;
  }, [saveHistory]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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

  const syncToServer = async (
    data: UnifiedPlayerEventData,
    completed = false,
  ) => {
    const currentUser = userRef.current;

    if (
      !saveHistoryRef.current ||
      !currentUser
    ) {
      return;
    }

    if (
      diff(
        data.currentTime,
        lastCurrentTimeRef.current,
      ) <= 5 &&
      !completed
    ) {
      return;
    }

    const currentMetadata =
      metadataRef.current;

    const payload: UnifiedPlayerEventData = {
      ...data,

      season:
        data.season ??
        currentMetadata?.season ??
        0,

      episode:
        data.episode ??
        currentMetadata?.episode ??
        0,
    };

    const { success, message } =
      await syncHistory(
        payload,
        completed,
      );

    if (success) {
      lastCurrentTimeRef.current =
        data.currentTime;
    } else {
      console.error(
        "Save history failed:",
        message,
      );
    }
  };

  /*
   * Save progress when the document becomes hidden.
   */

  useEffect(() => {
    if (!saveHistoryRef.current) {
      return;
    }

    if (documentState === "visible") {
      return;
    }

    const latestEvent =
      eventDataRef.current;

    if (!latestEvent) {
      return;
    }

    void syncToServer(latestEvent);
  }, [documentState]);

  /*
   * Listen for messages from supported players.
   *
   * IMPORTANT:
   * No player event updates React state.
   *
   * The latest event is stored in a ref instead,
   * which means timeupdate messages cannot cause
   * MoviePlayer to re-render.
   */

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        !saveHistoryRef.current ||
        !userRef.current
      ) {
        return;
      }

      const latestEvent =
        eventDataRef.current;

      if (!latestEvent) {
        return;
      }

      const payload = {
        ...latestEvent,
        completed:
          latestEvent.event === "ended",
      };

      navigator.sendBeacon(
        "/api/player/save-history",
        JSON.stringify(payload),
      );
    };

    const handleMessage = (
      event: MessageEvent,
    ) => {
      const adapter = Object.values(
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
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;
      } catch {
        console.warn(
          "Invalid JSON from player:",
          event.data,
        );

        return;
      }

      const parsed =
        adapter.parse(rawData);

      if (!parsed) {
        return;
      }

      /*
       * Store the latest player state without
       * triggering React rendering.
       */

      eventDataRef.current = parsed;

      switch (parsed.event) {
        case "play": {
          callbacksRef.current.onPlay?.(
            parsed,
          );

          break;
        }

        case "pause": {
          callbacksRef.current.onPause?.(
            parsed,
          );

          break;
        }

        case "seeked": {
          callbacksRef.current.onSeeked?.(
            parsed,
          );

          /*
           * A seek is an important history point,
           * so sync it immediately.
           */

          void syncToServer(parsed);

          break;
        }

        case "timeupdate": {
          /*
           * DO NOT call setState here.
           *
           * timeupdate can fire repeatedly while
           * the movie is playing.
           */

          callbacksRef.current.onTimeUpdate?.(
            parsed,
          );

          break;
        }

        case "ended": {
          void syncToServer(
            parsed,
            true,
          );

          callbacksRef.current.onEnded?.(
            parsed,
          );

          break;
        }
      }
    };

    window.addEventListener(
      "message",
      handleMessage,
    );

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
    );

    return () => {
      handleBeforeUnload();

      window.removeEventListener(
        "message",
        handleMessage,
      );

      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, []);

  /*
   * Keep the same public API shape, but the values
   * are no longer React state.
   *
   * MoviePlayer currently ignores this return value.
   */

  return {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    lastEvent: null as PlayerEventType | null,
  };
      }
