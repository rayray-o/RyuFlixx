import { syncHistory } from "@/actions/histories";
import { ContentType } from "@/types";
import { diff } from "@/utils/helpers";
import { useDocumentVisibility } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";
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
  parse: (raw: RawMessage) => UnifiedPlayerEventData | null;
}

export type AdapterMap = Record<string, PlayerAdapter<any>>;

export const playerAdapters = {
  vidlink: {
    origin: "https://vidlink.pro",

    parse: (raw) => {
      if (raw.type !== "PLAYER_EVENT") return null;

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
      if (raw.type !== "PLAYER_EVENT") return null;

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

  onPlay?: (data: UnifiedPlayerEventData) => void;
  onPause?: (data: UnifiedPlayerEventData) => void;
  onSeeked?: (data: UnifiedPlayerEventData) => void;
  onEnded?: (data: UnifiedPlayerEventData) => void;
  onTimeUpdate?: (data: UnifiedPlayerEventData) => void;
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
   * Fast player events should NOT constantly update React state.
   *
   * timeupdate can fire many times while a video is playing.
   * Keeping rapidly-changing values in refs prevents unnecessary
   * re-renders of the movie/player page.
   */

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastEvent, setLastEvent] =
    useState<PlayerEventType | null>(null);

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

  /*
   * Keep refs synchronized without recreating the window
   * message listener every render.
   */

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

    if (!saveHistoryRef.current || !currentUser) {
      return;
    }

    /*
     * Use the ref rather than React state so this value is
     * always current inside async/event callbacks.
     */

    if (
      diff(
        data.currentTime,
        lastCurrentTimeRef.current,
      ) <= 5 &&
      !completed
    ) {
      return;
    }

    const currentMetadata = metadataRef.current;

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
      await syncHistory(payload, completed);

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
    if (!saveHistoryRef.current) return;
    if (documentState === "visible") return;

    const latestEvent = eventDataRef.current;

    if (!latestEvent) return;

    void syncToServer(latestEvent);
  }, [documentState]);

  /*
   * Listen for player events.
   *
   * The listener is installed ONCE.
   * Rapid timeupdate events no longer cause a cascade
   * of React renders.
   */

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        !saveHistoryRef.current ||
        !userRef.current
      ) {
        return;
      }

      const latestEvent = eventDataRef.current;

      if (!latestEvent) return;

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

    const handleMessage = (event: MessageEvent) => {
      const adapter = Object.values(
        playerAdapters,
      ).find(
        (candidate) =>
          candidate.origin === event.origin,
      );

      if (!adapter) return;

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

      const parsed = adapter.parse(rawData);

      if (!parsed) return;

      /*
       * Always keep the newest player event in a ref.
       * This does not trigger a React render.
       */

      eventDataRef.current = parsed;

      switch (parsed.event) {
        case "play": {
          setIsPlaying(true);
          setLastEvent("play");

          callbacksRef.current.onPlay?.(
            parsed,
          );

          break;
        }

        case "pause": {
          setIsPlaying(false);
          setLastEvent("pause");

          callbacksRef.current.onPause?.(
            parsed,
          );

          break;
        }

        case "seeked": {
          setCurrentTime(
            parsed.currentTime,
          );

          setDuration(parsed.duration);
          setLastEvent("seeked");

          callbacksRef.current.onSeeked?.(
            parsed,
          );

          break;
        }

        case "timeupdate": {
          /*
           * Keep these updates lightweight.
           *
           * The event is still exposed to consumers,
           * but history syncing is NOT performed on
           * every timeupdate.
           */

          setCurrentTime(
            parsed.currentTime,
          );

          setDuration(parsed.duration);
          setLastEvent("timeupdate");

          callbacksRef.current.onTimeUpdate?.(
            parsed,
          );

          break;
        }

        case "ended": {
          setIsPlaying(false);
          setLastEvent("ended");

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
      /*
       * Save the latest state one final time.
       */

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

  return {
    isPlaying,
    currentTime,
    duration,
    lastEvent,
  };
    }
