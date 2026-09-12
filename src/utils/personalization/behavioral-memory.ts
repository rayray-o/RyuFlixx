"use client";

import type { ContentType } from "@/types";
import {
  getWatchHistory,
  type LocalWatchHistory,
} from "@/utils/localStorage";

const BEHAVIOR_STORAGE_KEY =
  "ryuflix_behavioral_memory_v1";

const MAX_EVENTS = 500;

export type BehavioralEventType =
  | "started"
  | "progress"
  | "completed"
  | "abandoned"
  | "rewatched";

export interface BehavioralEvent {
  id: string;

  mediaId: number;
  mediaType: ContentType;

  season?: number;
  episode?: number;

  event: BehavioralEventType;

  progress: number;

  timestamp: string;
}

export interface BehavioralMemory {
  version: 1;

  events: BehavioralEvent[];

  media: Record<
    string,
    {
      starts: number;
      completions: number;
      abandons: number;
      rewatches: number;

      totalProgress: number;
      lastProgress: number;

      lastWatchedAt: string;
    }
  >;

  preferences: {
    mediaTypes: Record<
      ContentType,
      number
    >;

    completionByMediaType: Record<
      ContentType,
      number
    >;

    progressByMediaType: Record<
      ContentType,
      number
    >;
  };
}

function isBrowser(): boolean {
  return (
    typeof window !== "undefined"
  );
}

function createEmptyMemory(): BehavioralMemory {
  return {
    version: 1,

    events: [],

    media: {},

    preferences: {
      mediaTypes: {
        movie: 0,
        tv: 0,
      },

      completionByMediaType: {
        movie: 0,
        tv: 0,
      },

      progressByMediaType: {
        movie: 0,
        tv: 0,
      },
    },
  };
}

function safelyParseMemory(
  value: string | null,
): BehavioralMemory {
  if (!value) {
    return createEmptyMemory();
  }

  try {
    const parsed =
      JSON.parse(value) as Partial<BehavioralMemory>;

    if (
      !parsed ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.events) ||
      !parsed.media ||
      typeof parsed.media !==
        "object"
    ) {
      return createEmptyMemory();
    }

    return {
      ...createEmptyMemory(),
      ...parsed,
      preferences: {
        ...createEmptyMemory()
          .preferences,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return createEmptyMemory();
  }
}

function readMemory(): BehavioralMemory {
  if (!isBrowser()) {
    return createEmptyMemory();
  }

  return safelyParseMemory(
    window.localStorage.getItem(
      BEHAVIOR_STORAGE_KEY,
    ),
  );
}

function saveMemory(
  memory: BehavioralMemory,
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    memory.events =
      memory.events.slice(
        -MAX_EVENTS,
      );

    window.localStorage.setItem(
      BEHAVIOR_STORAGE_KEY,
      JSON.stringify(memory),
    );
  } catch {
    /*
     * Behavioral learning is optional.
     * Storage failures must never break RyuFlix.
     */
  }
}

function mediaKey(
  mediaId: number,
  mediaType: ContentType,
  season?: number,
  episode?: number,
): string {
  if (mediaType === "tv") {
    return [
      "tv",
      mediaId,
      season ?? 0,
      episode ?? 0,
    ].join(":");
  }

  return `movie:${mediaId}`;
}

function eventId(
  mediaId: number,
  mediaType: ContentType,
  event: BehavioralEventType,
  timestamp: string,
  season?: number,
  episode?: number,
): string {
  return [
    mediaKey(
      mediaId,
      mediaType,
      season,
      episode,
    ),
    event,
    timestamp,
  ].join(":");
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function progressFromHistory(
  item: LocalWatchHistory,
): number {
  if (
    item.completed
  ) {
    return 1;
  }

  if (
    item.duration <= 0 ||
    !Number.isFinite(item.duration)
  ) {
    return 0;
  }

  return clamp(
    item.last_position /
      item.duration,
    0,
    1,
  );
}

function recencyWeight(
  timestamp: string,
): number {
  const time =
    new Date(timestamp).getTime();

  if (!Number.isFinite(time)) {
    return 0.1;
  }

  const age =
    Math.max(
      0,
      Date.now() - time,
    );

  const days =
    age /
    (1000 * 60 * 60 * 24);

  /*
   * Recent behavior matters more,
   * while old behavior never becomes
   * completely irrelevant.
   */
  return Math.max(
    0.15,
    Math.exp(-days / 45),
  );
}

function addEvent(
  memory: BehavioralMemory,
  event: BehavioralEvent,
): void {
  memory.events.push(event);

  const key = mediaKey(
    event.mediaId,
    event.mediaType,
    event.season,
    event.episode,
  );

  const existing =
    memory.media[key] ?? {
      starts: 0,
      completions: 0,
      abandons: 0,
      rewatches: 0,
      totalProgress: 0,
      lastProgress: 0,
      lastWatchedAt:
        event.timestamp,
    };

  const weight =
    recencyWeight(
      event.timestamp,
    );

  if (
    event.event ===
    "started"
  ) {
    existing.starts +=
      weight;
  }

  if (
    event.event ===
    "completed"
  ) {
    existing.completions +=
      weight;
  }

  if (
    event.event ===
    "abandoned"
  ) {
    existing.abandons +=
      weight;
  }

  if (
    event.event ===
    "rewatched"
  ) {
    existing.rewatches +=
      weight;
  }

  existing.totalProgress +=
    event.progress *
    weight;

  existing.lastProgress =
    event.progress;

  existing.lastWatchedAt =
    event.timestamp;

  memory.media[key] =
    existing;

  memory.preferences.mediaTypes[
    event.mediaType
  ] += weight;

  memory.preferences.progressByMediaType[
    event.mediaType
  ] +=
    event.progress *
    weight;

  if (
    event.event ===
    "completed"
  ) {
    memory.preferences
      .completionByMediaType[
      event.mediaType
    ] += weight;
  }
}

function buildEventsFromHistory(
  history: LocalWatchHistory[],
): BehavioralEvent[] {
  const events: BehavioralEvent[] =
    [];

  /*
   * History contains the latest state
   * of every movie/episode.
   *
   * We turn those states into stable
   * behavioral signals.
   */
  for (const item of history) {
    const progress =
      progressFromHistory(
        item,
      );

    const timestamp =
      item.updated_at;

    if (
      !timestamp ||
      !Number.isFinite(
        item.media_id,
      )
    ) {
      continue;
    }

    const base = {
      mediaId: item.media_id,
      mediaType: item.type,
      season: item.season,
      episode: item.episode,
      progress,
      timestamp,
    };

    /*
     * Every history item represents
     * at least one viewing start.
     */
    events.push({
      ...base,
      event: "started",
      id: eventId(
        item.media_id,
        item.type,
        "started",
        timestamp,
        item.season,
        item.episode,
      ),
    });

    /*
     * Very small progress indicates
     * an early abandonment.
     *
     * We intentionally use a low
     * threshold so ordinary pauses
     * don't become strong negatives.
     */
    if (
      !item.completed &&
      progress > 0 &&
      progress < 0.12
    ) {
      events.push({
        ...base,
        event: "abandoned",
        id: eventId(
          item.media_id,
          item.type,
          "abandoned",
          timestamp,
          item.season,
          item.episode,
        ),
      });
    }

    /*
     * A substantial partial watch is
     * useful positive engagement.
     */
    if (
      !item.completed &&
      progress >= 0.12
    ) {
      events.push({
        ...base,
        event: "progress",
        id: eventId(
          item.media_id,
          item.type,
          "progress",
          timestamp,
          item.season,
          item.episode,
        ),
      });
    }

    /*
     * Completed viewing is the strongest
     * behavioral signal in this first layer.
     */
    if (item.completed) {
      events.push({
        ...base,
        event: "completed",
        id: eventId(
          item.media_id,
          item.type,
          "completed",
          timestamp,
          item.season,
          item.episode,
        ),
      });
    }
  }

  return events;
}

export function getBehavioralMemory(): BehavioralMemory {
  const stored =
    readMemory();

  const history =
    getWatchHistory();

  /*
   * Rebuild the behavioral layer from
   * the current history so it naturally
   * stays synchronized with existing
   * RyuFlix progress.
   */
  const rebuilt =
    createEmptyMemory();

  const historyEvents =
    buildEventsFromHistory(
      history,
    );

  for (const event of
    historyEvents) {
    addEvent(
      rebuilt,
      event,
    );
  }

  /*
   * Preserve explicit behavioral events
   * that aren't derivable from history.
   */
  const historyEventIds =
    new Set(
      historyEvents.map(
        (event) => event.id,
      ),
    );

  for (const event of
    stored.events) {
    if (
      !historyEventIds.has(
        event.id,
      )
    ) {
      addEvent(
        rebuilt,
        event,
      );
    }
  }

  saveMemory(
    rebuilt,
  );

  return rebuilt;
}

export function recordBehavioralEvent(
  event: Omit<
    BehavioralEvent,
    "id"
  >,
): void {
  if (!isBrowser()) {
    return;
  }

  const memory =
    readMemory();

  const timestamp =
    event.timestamp ||
    new Date().toISOString();

  const completeEvent: BehavioralEvent =
    {
      ...event,
      timestamp,
      id: eventId(
        event.mediaId,
        event.mediaType,
        event.event,
        timestamp,
        event.season,
        event.episode,
      ),
    };

  const duplicate =
    memory.events.some(
      (existing) =>
        existing.id ===
        completeEvent.id,
    );

  if (duplicate) {
    return;
  }

  addEvent(
    memory,
    completeEvent,
  );

  saveMemory(
    memory,
  );
}

export function getMediaBehavior(
  mediaId: number,
  mediaType: ContentType,
  season?: number,
  episode?: number,
) {
  const memory =
    getBehavioralMemory();

  return (
    memory.media[
      mediaKey(
        mediaId,
        mediaType,
        season,
        episode,
      )
    ] ?? null
  );
}

export function getBehavioralSignal(
  mediaId: number,
  mediaType: ContentType,
): number {
  const behavior =
    getMediaBehavior(
      mediaId,
      mediaType,
    );

  if (!behavior) {
    return 0;
  }

  /*
   * Positive behavior:
   *
   * completion > progress > start
   *
   * Negative behavior:
   *
   * abandonment.
   *
   * Rewatching is particularly strong.
   */
  const positive =
    behavior.starts * 0.35 +
    behavior.completions * 2.8 +
    behavior.rewatches * 3.5 +
    behavior.totalProgress *
      0.45;

  const negative =
    behavior.abandons * 2.2;

  return positive - negative;
}

export function getBehavioralSummary() {
  const memory =
    getBehavioralMemory();

  const movieActivity =
    memory.preferences
      .mediaTypes.movie;

  const tvActivity =
    memory.preferences
      .mediaTypes.tv;

  const movieCompletion =
    memory.preferences
      .completionByMediaType
      .movie;

  const tvCompletion =
    memory.preferences
      .completionByMediaType
      .tv;

  const movieProgress =
    memory.preferences
      .progressByMediaType
      .movie;

  const tvProgress =
    memory.preferences
      .progressByMediaType
      .tv;

  const preferredMediaType =
    movieActivity >
    tvActivity * 1.2
      ? "movie"
      : tvActivity >
          movieActivity * 1.2
        ? "tv"
        : "balanced";

  return {
    preferredMediaType,

    movieActivity,
    tvActivity,

    movieCompletion,
    tvCompletion,

    movieProgress,
    tvProgress,

    totalEvents:
      memory.events.length,

    trackedMedia:
      Object.keys(
        memory.media,
      ).length,
  };
}

export function clearBehavioralMemory(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(
    BEHAVIOR_STORAGE_KEY,
  );
  }
