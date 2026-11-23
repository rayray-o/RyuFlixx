
"use client";

import type { ContentType } from "@/types";
import {
  getWatchHistory,
  getLocalWatchlist,
} from "@/utils/localStorage";
import {
  getBehavioralMemory,
  type BehavioralEvent,
} from "@/utils/personalization/behavioral-memory";

export interface FeedbackVector {
  id: number;
  mediaType: ContentType;

  /** Normalized positive evidence, from 0 to 1. */
  positive: number;

  /** Normalized negative evidence, from 0 to 1. */
  negative: number;

  /** Overall confidence that this feedback represents real interest. */
  confidence: number;

  /** Engagement estimate used as the learned model's target. */
  label: number;

  /** Training importance, capped to prevent repeated activity dominating. */
  weight: number;

  /** Most recent known activity for this title. */
  timestamp: string;

  /** Highest known playback completion ratio. */
  progress: number;

  /** Whether playback reached completion. */
  completed: boolean;

  /** Whether the title is currently saved to the watchlist. */
  watchlisted: boolean;

  /** Number of distinct TV episodes represented by this show. */
  episodeCount: number;

  /** Number of recorded rewatches. */
  rewatches: number;

  /** Number of recorded early abandonments. */
  abandons: number;

  /** Evidence categories contributing to this vector. */
  evidence: string[];
}

type FeedbackAccumulator = {
  id: number;
  mediaType: ContentType;

  progress: number;
  completed: boolean;
  watchlisted: boolean;

  opens: number;
  starts: number;
  progressEvents: number;
  completions: number;
  rewatches: number;
  abandons: number;

  episodeKeys: Set<string>;
  timestamps: string[];
};

const MAX_FEEDBACK_ITEMS = 160;
const RECENCY_HALF_LIFE_DAYS = 60;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}

function latestTimestamp(values: string[]): string {
  return values
    .filter(Boolean)
    .sort(
      (a, b) =>
        validTimestamp(b) - validTimestamp(a),
    )[0] ?? new Date(0).toISOString();
}

function recencyWeight(timestamp: string): number {
  const time = validTimestamp(timestamp);

  if (!time) return 0.1;

  const ageDays = Math.max(
    0,
    (Date.now() - time) / 86_400_000,
  );

  // Smoothly reduces the influence of old activity.
  // Recent activity matters more, but old preferences
  // do not suddenly disappear.
  return Math.max(
    0.08,
    Math.pow(
      0.5,
      ageDays / RECENCY_HALF_LIFE_DAYS,
    ),
  );
}

function createAccumulator(
  id: number,
  mediaType: ContentType,
): FeedbackAccumulator {
  return {
    id,
    mediaType,

    progress: 0,
    completed: false,
    watchlisted: false,

    opens: 0,
    starts: 0,
    progressEvents: 0,
    completions: 0,
    rewatches: 0,
    abandons: 0,

    episodeKeys: new Set(),
    timestamps: [],
  };
}

function getKey(
  id: number,
  mediaType: ContentType,
): string {
  return `${mediaType}:${id}`;
}

function addTimestamp(
  target: FeedbackAccumulator,
  timestamp: string,
): void {
  if (timestamp) {
    target.timestamps.push(timestamp);
  }
}

function addBehavioralEvent(
  target: FeedbackAccumulator,
  event: BehavioralEvent,
): void {
  addTimestamp(target, event.timestamp);

  if (event.mediaType === "tv") {
    target.episodeKeys.add(
      `${event.season ?? 0}:${event.episode ?? 0}`,
    );
  }

  target.progress = Math.max(
    target.progress,
    clamp(event.progress, 0, 1),
  );

  switch (event.event) {
    case "opened":
      target.opens += 1;
      break;

    case "started":
      target.starts += 1;
      break;

    case "progress":
      target.progressEvents += 1;
      break;

    case "completed":
      target.completions += 1;
      target.completed = true;
      target.progress = 1;
      break;

    case "rewatched":
      target.rewatches += 1;
      break;

    case "abandoned":
      target.abandons += 1;
      break;

    case "paused":
    case "seeked":
      // These are useful behavioral events, but
      // neither one independently proves interest.
      break;
  }
}

function buildVector(
  item: FeedbackAccumulator,
): FeedbackVector {
  const timestamp = latestTimestamp(item.timestamps);
  const recency = recencyWeight(timestamp);

  const progress = item.completed
    ? 1
    : clamp(item.progress, 0, 1);

  // Repeated events have diminishing returns.
  // This prevents a player emitting frequent progress
  // updates from overwhelming other evidence.
  const openSignal = Math.log1p(
    Math.min(item.opens, 5),
  ) * 0.035;

  const startSignal = Math.log1p(
    Math.min(item.starts, 4),
  ) * 0.07;

  const progressSignal = Math.log1p(
    Math.min(item.progressEvents, 5),
  ) * 0.035;

  const completionSignal = item.completed
    ? 0.48
    : Math.min(item.completions, 2) * 0.2;

  const rewatchSignal =
    Math.log1p(Math.min(item.rewatches, 4)) * 0.16;

  const watchlistSignal = item.watchlisted
    ? 0.2
    : 0;

  const sustainedSignal =
    Math.pow(progress, 1.35) * 0.42;

  const rawPositive =
    openSignal +
    startSignal +
    progressSignal +
    completionSignal +
    rewatchSignal +
    watchlistSignal +
    sustainedSignal;

  // Abandonment only matters when playback barely began.
  // A user stopping halfway through is not automatically
  // evidence that they disliked the title.
  const earlyAbandonment =
    item.abandons > 0 && progress < 0.12;

  const rawNegative = earlyAbandonment
    ? Math.min(
        0.24,
        0.09 +
          Math.log1p(
            Math.min(item.abandons, 3),
          ) * 0.055,
      )
    : 0;

  const positive = clamp(
    rawPositive * recency,
    0,
    1,
  );

  const negative = clamp(
    rawNegative * recency,
    0,
    1,
  );

  const evidence: string[] = [];

  if (item.opens > 0) evidence.push("opened");
  if (item.starts > 0) evidence.push("started");
  if (progress >= 0.12) evidence.push("sustained-viewing");
  if (item.completed) evidence.push("completed");
  if (item.rewatches > 0) evidence.push("rewatched");
  if (item.watchlisted) evidence.push("watchlisted");
  if (earlyAbandonment) evidence.push("early-abandonment");

  const activityCount =
    Math.min(item.opens, 3) +
    Math.min(item.starts, 3) +
    Math.min(item.progressEvents, 3) +
    Math.min(item.completions, 2) +
    Math.min(item.rewatches, 2) +
    (item.watchlisted ? 1 : 0);

  const confidence = clamp(
    (1 - Math.exp(-activityCount * 0.32)) *
      (0.55 + recency * 0.45),
    0,
    1,
  );

  let label: number;

  if (item.completed) {
    label = 0.98;
  } else if (item.rewatches > 0) {
    label = 0.96;
  } else if (progress >= 0.8) {
    label = 0.92;
  } else if (progress >= 0.55) {
    label = 0.83;
  } else if (progress >= 0.3) {
    label = 0.72;
  } else if (progress >= 0.12) {
    label = 0.59;
  } else if (earlyAbandonment) {
    // Weak negative evidence, deliberately not a hard dislike.
    label = 0.36;
  } else if (item.watchlisted) {
    // Saving something expresses intent, not guaranteed enjoyment.
    label = 0.68;
  } else {
    label = 0.5;
  }

  // Watchlist-only feedback should have lower training
  // importance than actual playback behavior.
  const playbackWeight =
    progress > 0
      ? 0.45 + progress * 0.9
      : 0;

  const interactionWeight =
    Math.min(item.starts, 3) * 0.12 +
    Math.min(item.opens, 3) * 0.04 +
    Math.min(item.rewatches, 3) * 0.2;

  const weight = clamp(
    (
      playbackWeight +
      interactionWeight +
      (item.completed ? 0.65 : 0) +
      (item.watchlisted ? 0.3 : 0) +
      (earlyAbandonment ? 0.12 : 0)
    ) * (0.55 + recency * 0.45),
    0.15,
    2.5,
  );

  return {
    id: item.id,
    mediaType: item.mediaType,

    positive,
    negative,
    confidence,

    label,
    weight,

    timestamp,
    progress,

    completed: item.completed,
    watchlisted: item.watchlisted,

    episodeCount: item.episodeKeys.size,
    rewatches: item.rewatches,
    abandons: item.abandons,

    evidence,
  };
}

/**
 * Builds normalized, profile-specific feedback vectors.
 *
 * The underlying watch history, watchlist and behavioral memory
 * are already isolated by RyuFlixx's active-profile storage.
 *
 * Important:
 * - Unseen titles are never generated as negative examples.
 * - Watchlist removal is not interpreted as dislike.
 * - TV episodes are consolidated into one show-level vector.
 * - Repeated events are capped and have diminishing returns.
 */
export function getFeedbackVectors(
  mediaType?: ContentType,
): FeedbackVector[] {
  const items = new Map<string, FeedbackAccumulator>();

  const getOrCreate = (
    id: number,
    type: ContentType,
  ): FeedbackAccumulator => {
    const key = getKey(id, type);
    const existing = items.get(key);

    if (existing) return existing;

    const created = createAccumulator(id, type);
    items.set(key, created);

    return created;
  };

  // Playback history supplies the strongest evidence.
  for (const entry of getWatchHistory()) {
    if (
      !entry ||
      (entry.type !== "movie" && entry.type !== "tv") ||
      !Number.isFinite(entry.media_id)
    ) {
      continue;
    }

    if (mediaType && entry.type !== mediaType) {
      continue;
    }

    const target = getOrCreate(
      entry.media_id,
      entry.type,
    );

    const progress = entry.completed
      ? 1
      : entry.duration > 0
        ? clamp(
            entry.last_position / entry.duration,
            0,
            1,
          )
        : 0;

    target.progress = Math.max(
      target.progress,
      progress,
    );

    target.completed =
      target.completed || entry.completed;

    addTimestamp(target, entry.updated_at);

    if (entry.type === "tv") {
      target.episodeKeys.add(
        `${entry.season ?? 0}:${entry.episode ?? 0}`,
      );
    }
  }

  // Behavioral events add richer context, but are aggregated
  // with caps later so noisy progress reporting cannot dominate.
  const memory = getBehavioralMemory();

  for (const event of memory.events) {
    if (
      !event ||
      (event.mediaType !== "movie" &&
        event.mediaType !== "tv") ||
      !Number.isFinite(event.mediaId)
    ) {
      continue;
    }

    if (mediaType && event.mediaType !== mediaType) {
      continue;
    }

    const target = getOrCreate(
      event.mediaId,
      event.mediaType,
    );

    addBehavioralEvent(target, event);
  }

  // A current watchlist save is a modest positive-intent signal.
  // Removal is intentionally not treated as negative feedback.
  for (const entry of getLocalWatchlist()) {
    if (
      !entry ||
      (entry.type !== "movie" && entry.type !== "tv") ||
      !Number.isFinite(entry.id)
    ) {
      continue;
    }

    if (mediaType && entry.type !== mediaType) {
      continue;
    }

    const target = getOrCreate(
      entry.id,
      entry.type,
    );

    target.watchlisted = true;
    addTimestamp(target, entry.saved_date);
  }

  return [...items.values()]
    .map(buildVector)
    .filter((vector) => {
      // A vector must contain real interaction evidence.
      // Merely existing in TMDB or being recommended is not enough.
      return (
        vector.positive > 0 ||
        vector.negative > 0 ||
        vector.watchlisted
      );
    })
    .sort(
      (a, b) =>
        validTimestamp(b.timestamp) -
        validTimestamp(a.timestamp),
    )
    .slice(0, MAX_FEEDBACK_ITEMS);
}

/**
 * Returns one title's normalized feedback, if the active profile
 * has any recorded interaction with it.
 */
export function getItemFeedbackVector(
  id: number,
  mediaType: ContentType,
): FeedbackVector | null {
  return (
    getFeedbackVectors(mediaType).find(
      (vector) => vector.id === id,
    ) ?? null
  );
}
