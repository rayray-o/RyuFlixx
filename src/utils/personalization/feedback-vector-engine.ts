
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
import {
  getAllExplicitFeedback,
  type ExplicitFeedbackValue,
} from "@/utils/personalization/explicit-feedback-engine";

export interface FeedbackVector {
  id: number;
  mediaType: ContentType;
  positive: number;
  negative: number;
  confidence: number;
  label: number;
  weight: number;
  timestamp: string;
  progress: number;
  completed: boolean;
  watchlisted: boolean;
  episodeCount: number;
  completedEpisodeCount: number;
  rewatches: number;
  abandons: number;
  explicitFeedback: ExplicitFeedbackValue | null;
  evidence: string[];
}

type FeedbackAccumulator = {
  id: number;
  mediaType: ContentType;

  progress: number;
  completed: boolean;
  watchlisted: boolean;
  explicitFeedback: ExplicitFeedbackValue | null;

  opens: number;
  starts: number;
  progressEvents: number;
  completions: number;
  rewatches: number;
  abandons: number;

  episodeProgress: Map<string, number>;
  completedEpisodes: Set<string>;
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
  let latest = "";
  let latestTime = 0;

  for (const value of values) {
    const time = validTimestamp(value);

    if (time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }

  return latest || new Date(0).toISOString();
}

function recencyWeight(timestamp: string): number {
  const time = validTimestamp(timestamp);

  if (!time) {
    return 0.1;
  }

  const ageDays = Math.max(
    0,
    (Date.now() - time) / 86_400_000,
  );

  return Math.max(
    0.08,
    Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS),
  );
}

function episodeKey(
  season?: number,
  episode?: number,
): string {
  return `${season ?? 0}:${episode ?? 0}`;
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
    explicitFeedback: null,

    opens: 0,
    starts: 0,
    progressEvents: 0,
    completions: 0,
    rewatches: 0,
    abandons: 0,

    episodeProgress: new Map(),
    completedEpisodes: new Set(),
    timestamps: [],
  };
}

function addTimestamp(
  target: FeedbackAccumulator,
  timestamp: string,
): void {
  if (timestamp) {
    target.timestamps.push(timestamp);
  }
}

function addEpisodeProgress(
  target: FeedbackAccumulator,
  key: string,
  progress: number,
): void {
  const safeProgress = clamp(progress, 0, 1);

  target.episodeProgress.set(
    key,
    Math.max(
      target.episodeProgress.get(key) ?? 0,
      safeProgress,
    ),
  );
}

function addBehavioralEvent(
  target: FeedbackAccumulator,
  event: BehavioralEvent,
): void {
  addTimestamp(target, event.timestamp);

  if (event.mediaType === "tv") {
    const key = episodeKey(
      event.season,
      event.episode,
    );

    addEpisodeProgress(
      target,
      key,
      event.progress,
    );

    if (event.event === "completed") {
      target.completedEpisodes.add(key);

      addEpisodeProgress(
        target,
        key,
        1,
      );
    }
  } else {
    target.progress = Math.max(
      target.progress,
      clamp(event.progress, 0, 1),
    );

    if (event.event === "completed") {
      target.completed = true;
      target.progress = 1;
    }
  }

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
      break;

    case "rewatched":
      target.rewatches += 1;
      break;

    case "abandoned":
      target.abandons += 1;
      break;

    case "paused":
    case "seeked":
      break;
  }
}

function getAggregateProgress(
  item: FeedbackAccumulator,
): number {
  if (item.mediaType === "movie") {
    return item.completed
      ? 1
      : clamp(item.progress, 0, 1);
  }

  if (item.episodeProgress.size === 0) {
    return 0;
  }

  let total = 0;

  for (const progress of item.episodeProgress.values()) {
    total += progress;
  }

  // Average across distinct episodes, not individual events.
  return clamp(
    total / item.episodeProgress.size,
    0,
    1,
  );
}

function buildVector(
  item: FeedbackAccumulator,
): FeedbackVector {
  const timestamp = latestTimestamp(item.timestamps);
  const recency = recencyWeight(timestamp);
  const progress = getAggregateProgress(item);

  // A TV episode is not equivalent to completing an entire show.
  const completed =
    item.mediaType === "movie" && item.completed;

  const completedEpisodeCount =
    item.completedEpisodes.size;

  const episodeCount =
    item.mediaType === "tv"
      ? item.episodeProgress.size
      : 0;

  // Diminishing returns prevent repeated events dominating.
  const openSignal =
    Math.log1p(Math.min(item.opens, 5)) * 0.035;

  const startSignal =
    Math.log1p(Math.min(item.starts, 4)) * 0.07;

  const progressSignal =
    Math.log1p(Math.min(item.progressEvents, 5)) * 0.035;

  const completionSignal =
    item.mediaType === "movie"
      ? completed
        ? 0.48
        : Math.min(item.completions, 2) * 0.2
      : Math.min(completedEpisodeCount, 3) * 0.12;

  const rewatchSignal =
    Math.log1p(Math.min(item.rewatches, 4)) * 0.16;

  const watchlistSignal =
    item.watchlisted ? 0.2 : 0;

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

  // Abandonment is weak negative evidence only when playback
  // barely began. It is never treated as an explicit dislike.
  const earlyAbandonment =
    item.abandons > 0 && progress < 0.12;

  const rawNegative = earlyAbandonment
    ? Math.min(
        0.24,
        0.09 +
          Math.log1p(Math.min(item.abandons, 3)) * 0.055,
      )
    : 0;

  let positive = clamp(
    rawPositive * recency,
    0,
    1,
  );

  let negative = clamp(
    rawNegative * recency,
    0,
    1,
  );

  const evidence: string[] = [];

  if (item.opens > 0) evidence.push("opened");
  if (item.starts > 0) evidence.push("started");
  if (progress >= 0.12) evidence.push("sustained-viewing");
  if (completed) evidence.push("completed");

  if (completedEpisodeCount > 0) {
    evidence.push("episode-completion");
  }

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

  let confidence = clamp(
    (1 - Math.exp(-activityCount * 0.32)) *
      (0.55 + recency * 0.45),
    0,
    1,
  );

  let label: number;

  if (completed) {
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
    label = 0.36;
  } else if (item.watchlisted) {
    label = 0.68;
  } else {
    label = 0.5;
  }

  let weight = clamp(
    (
      (progress > 0 ? 0.45 + progress * 0.9 : 0) +
      Math.min(item.starts, 3) * 0.12 +
      Math.min(item.opens, 3) * 0.04 +
      Math.min(item.rewatches, 3) * 0.2 +
      (completed ? 0.65 : 0) +
      (item.mediaType === "tv"
        ? Math.min(completedEpisodeCount, 3) * 0.12
        : 0) +
      (item.watchlisted ? 0.3 : 0) +
      (earlyAbandonment ? 0.12 : 0)
    ) * (0.55 + recency * 0.45),
    0.15,
    2.5,
  );

  // Explicit opinions override inferred viewing signals.
  // They remain strong but decay gradually with time.
  switch (item.explicitFeedback) {
    case "like":
      positive = Math.max(
        positive,
        0.95 * recency,
      );
      negative = Math.min(
        negative,
        0.05,
      );
      confidence = Math.max(
        confidence,
        0.98 * recency,
      );
      label = 0.99;
      weight = Math.max(
        weight,
        2.5 * recency,
      );
      evidence.push("explicit-like");
      break;

    case "dislike":
      negative = Math.max(
        negative,
        0.98 * recency,
      );
      positive = Math.min(
        positive,
        0.05,
      );
      confidence = Math.max(
        confidence,
        0.98 * recency,
      );
      label = 0.01;
      weight = Math.max(
        weight,
        2.5 * recency,
      );
      evidence.push("explicit-dislike");
      break;

    case "not_interested":
      negative = Math.max(
        negative,
        1 * recency,
      );
      positive = Math.min(
        positive,
        0.02,
      );
      confidence = Math.max(
        confidence,
        0.99 * recency,
      );
      label = 0.005;
      weight = Math.max(
        weight,
        2.5 * recency,
      );
      evidence.push("explicit-not-interested");
      break;
  }

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

    completed,
    watchlisted: item.watchlisted,

    episodeCount,
    completedEpisodeCount,

    rewatches: item.rewatches,
    abandons: item.abandons,

    explicitFeedback: item.explicitFeedback,

    evidence: [...new Set(evidence)],
  };
}

/**
 * Builds normalized feedback vectors from the active profile's
 * watch history, behavioral events, watchlist and explicit opinions.
 *
 * Unseen titles are never generated as negative examples.
 * Removing a title from the watchlist is not interpreted as dislike.
 * TV episodes are consolidated without treating one episode
 * as completion of the entire show.
 */
export function getFeedbackVectors(
  mediaType?: ContentType,
): FeedbackVector[] {
  const items = new Map<string, FeedbackAccumulator>();

  const getOrCreate = (
    id: number,
    type: ContentType,
  ): FeedbackAccumulator => {
    const key = `${type}:${id}`;
    const existing = items.get(key);

    if (existing) {
      return existing;
    }

    const created = createAccumulator(id, type);
    items.set(key, created);

    return created;
  };

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

    addTimestamp(
      target,
      entry.updated_at,
    );

    if (entry.type === "movie") {
      target.progress = Math.max(
        target.progress,
        progress,
      );

      target.completed =
        target.completed || entry.completed;
    } else {
      const key = episodeKey(
        entry.season,
        entry.episode,
      );

      addEpisodeProgress(
        target,
        key,
        progress,
      );

      if (entry.completed) {
        target.completedEpisodes.add(key);

        addEpisodeProgress(
          target,
          key,
          1,
        );
      }
    }
  }

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

    addBehavioralEvent(
      getOrCreate(
        event.mediaId,
        event.mediaType,
      ),
      event,
    );
  }

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

    addTimestamp(
      target,
      entry.saved_date,
    );
  }

  for (const feedback of getAllExplicitFeedback()) {
    if (
      !feedback ||
      (feedback.mediaType !== "movie" &&
        feedback.mediaType !== "tv")
    ) {
      continue;
    }

    if (mediaType && feedback.mediaType !== mediaType) {
      continue;
    }

    const target = getOrCreate(
      feedback.id,
      feedback.mediaType,
    );

    target.explicitFeedback = feedback.value;

    addTimestamp(
      target,
      feedback.updatedAt,
    );
  }

  return [...items.values()]
    .map(buildVector)
    .filter(
      (vector) =>
        vector.positive > 0 ||
        vector.negative > 0 ||
        vector.watchlisted ||
        vector.explicitFeedback !== null,
    )
    .sort(
      (a, b) =>
        validTimestamp(b.timestamp) -
        validTimestamp(a.timestamp),
    )
    .slice(0, MAX_FEEDBACK_ITEMS);
}

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
