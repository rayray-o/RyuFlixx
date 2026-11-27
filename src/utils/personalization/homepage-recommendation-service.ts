
"use client";

import type { ContentType } from "@/types";
import {
  getWatchHistory,
  getLocalWatchlist,
} from "@/utils/localStorage";
import {
  getAllExplicitFeedback,
} from "@/utils/personalization/explicit-feedback-engine";
import {
  getGorseInspiredRecommendations,
} from "@/utils/personalization/gorse-inspired-engine";
import {
  generateHomepageRows,
  clearHomepageGenerationCache,
  type HomepageRow,
} from "@/utils/personalization/homepage-generation-engine";
import type { RecommendationItem } from "@/utils/personalization/recommendation-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const DB_NAME = "ryuflix-homepage-cache";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";

const SNAPSHOT_TTL = 15 * 60 * 1000;
const MIN_REFRESH_INTERVAL = 90 * 1000;
const EVENT_DEBOUNCE = 1800;

type HomepageSnapshot = {
  type: ContentType;
  eligible: boolean;
  forYou: RecommendationItem[];
  rows: HomepageRow[];
  fingerprint: string;
  generatedAt: number;
};

type SnapshotListener = (
  snapshot: HomepageSnapshot,
) => void;

type StoredSnapshot = {
  key: string;
  snapshot: HomepageSnapshot;
};

const memoryCache = new Map<string, HomepageSnapshot>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Map<
  ContentType,
  Set<SnapshotListener>
>();
const refreshTimers = new Map<string, number>();

let databasePromise: Promise<IDBDatabase | null> | null =
  null;

function readProfile(): TasteProfile | null {
  try {
    const raw = localStorage.getItem(
      "ryuflix_taste_profile",
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      parsed?.tasteProfile &&
      typeof parsed.tasteProfile === "object"
    ) {
      return parsed.tasteProfile as TasteProfile;
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.confidence === "number"
    ) {
      return parsed as TasteProfile;
    }

    return null;
  } catch {
    return null;
  }
}

function hasTasteSignals(
  profile: TasteProfile | null,
): boolean {
  if (!profile) return false;

  if (
    profile.topGenres?.length ||
    profile.topKeywords?.length ||
    profile.topDirectors?.length ||
    profile.topActors?.length
  ) {
    return true;
  }

  return Object.values(
    profile.preferences ?? {},
  ).some((signals) =>
    Object.values(signals ?? {}).some(
      (score) =>
        typeof score === "number" &&
        Number.isFinite(score) &&
        score > 0,
    ),
  );
}

function hasPersonalizationData(): boolean {
  try {
    if (getWatchHistory().length > 0) return true;
  } catch {}

  try {
    if (getLocalWatchlist().length > 0) return true;
  } catch {}

  try {
    if (getAllExplicitFeedback().length > 0) return true;
  } catch {}

  return hasTasteSignals(readProfile());
}

function hash(value: string): string {
  let result = 2166136261;

  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }

  return (result >>> 0).toString(36);
}

function getProfileKey(): string {
  try {
    return (
      localStorage.getItem(
        "ryuflix_active_profile_v1",
      ) ?? "default"
    );
  } catch {
    return "default";
  }
}

function getSnapshotKey(
  type: ContentType,
): string {
  return `${type}:${hash(getProfileKey())}`;
}

function getActivityFingerprint(): string {
  const data: Record<string, unknown> = {};

  try {
    data.history = getWatchHistory().map((item) => [
      item.type,
      item.media_id,
      item.updated_at,
      item.last_position,
      item.completed,
      item.season,
      item.episode,
    ]);
  } catch {
    data.history = [];
  }

  try {
    data.watchlist = getLocalWatchlist().map((item) => [
      item.type,
      item.id,
      item.saved_date,
    ]);
  } catch {
    data.watchlist = [];
  }

  try {
    data.feedback = getAllExplicitFeedback().map((item) => [
      item.mediaType,
      item.id,
      item.value,
      item.updatedAt,
    ]);
  } catch {
    data.feedback = [];
  }

  try {
    data.taste = localStorage.getItem(
      "ryuflix_taste_profile",
    );
  } catch {
    data.taste = null;
  }

  return hash(JSON.stringify(data));
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (
        !database.objectStoreNames.contains(STORE_NAME)
      ) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };

      resolve(database);
    };

    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return databasePromise;
}

async function readPersistentSnapshot(
  key: string,
): Promise<HomepageSnapshot | null> {
  try {
    const database = await openDatabase();
    if (!database) return null;

    return await new Promise((resolve) => {
      const transaction = database.transaction(
        STORE_NAME,
        "readonly",
      );

      const request = transaction
        .objectStore(STORE_NAME)
        .get(key);

      request.onsuccess = () => {
        const result = request.result as
          | StoredSnapshot
          | undefined;

        resolve(result?.snapshot ?? null);
      };

      request.onerror = () => resolve(null);
      transaction.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writePersistentSnapshot(
  key: string,
  snapshot: HomepageSnapshot,
): Promise<void> {
  try {
    const database = await openDatabase();
    if (!database) return;

    await new Promise<void>((resolve) => {
      const transaction = database.transaction(
        STORE_NAME,
        "readwrite",
      );

      transaction.objectStore(STORE_NAME).put({
        key,
        snapshot,
      } satisfies StoredSnapshot);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    // The in-memory snapshot remains usable.
  }
}

function notify(
  type: ContentType,
  snapshot: HomepageSnapshot,
): void {
  for (const listener of listeners.get(type) ?? []) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error(
        "[RyuFlixx] Homepage listener failed:",
        error,
      );
    }
  }
}

function filterExplicitDislikes(
  items: RecommendationItem[],
): RecommendationItem[] {
  try {
    const excluded = new Set(
      getAllExplicitFeedback()
        .filter(
          (feedback) =>
            feedback.value === "dislike" ||
            feedback.value === "not_interested",
        )
        .map(
          (feedback) =>
            `${feedback.mediaType}:${feedback.id}`,
        ),
    );

    return items.filter(
      (item) =>
        !excluded.has(
          `${item.mediaType}:${item.id}`,
        ),
    );
  } catch {
    return items;
  }
}

async function getPreviousSnapshot(
  key: string,
): Promise<HomepageSnapshot | null> {
  const cached = memoryCache.get(key);

  if (cached) return cached;

  const persistent =
    await readPersistentSnapshot(key);

  if (persistent) {
    memoryCache.set(key, persistent);
  }

  return persistent;
}

async function generateSnapshot(
  type: ContentType,
  key: string,
): Promise<void> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const job = (async () => {
    const previous = await getPreviousSnapshot(key);
    const eligible = hasPersonalizationData();

    let recommendations: RecommendationItem[] = [];

    if (eligible) {
      try {
        recommendations =
          await getGorseInspiredRecommendations(
            type,
            30,
            readProfile(),
          );
      } catch (error) {
        console.warn(
          "[RyuFlixx] Recommendation ranking unavailable; generating shelves without it.",
          error,
        );
      }
    }

    let rows: HomepageRow[] = [];

    try {
      /*
       * Only clear a potentially failed empty cache.
       * Successful generator results keep their own TTL cache.
       */
      if (!previous || previous.rows.length === 0) {
        clearHomepageGenerationCache();
      }

      rows = await generateHomepageRows(
        type,
        recommendations,
      );
    } catch (error) {
      console.error(
        "[RyuFlixx] Personalized shelf generation failed:",
        error,
      );
    }

    const visibleRecommendations =
      filterExplicitDislikes(recommendations).slice(0, 12);

    const finalRows =
      rows.length > 0
        ? rows
        : previous?.rows ?? [];

    const finalForYou =
      visibleRecommendations.length > 0
        ? visibleRecommendations
        : filterExplicitDislikes(
            previous?.forYou ?? [],
          );

    const snapshot: HomepageSnapshot = {
      type,
      eligible:
        eligible ||
        Boolean(
          previous?.eligible &&
            (previous.rows.length > 0 ||
              previous.forYou.length > 0),
        ),
      forYou: finalForYou,
      rows: finalRows,
      fingerprint: getActivityFingerprint(),
      generatedAt: Date.now(),
    };

    memoryCache.set(key, snapshot);

    await writePersistentSnapshot(key, snapshot);

    notify(type, snapshot);
  })();

  inFlight.set(key, job);

  try {
    await job;
  } catch (error) {
    console.error(
      "[RyuFlixx] Homepage generation failed:",
      error,
    );

    const previous = await getPreviousSnapshot(key);

    if (previous) {
      notify(type, previous);
    }
  } finally {
    if (inFlight.get(key) === job) {
      inFlight.delete(key);
    }
  }
}

function scheduleGeneration(
  type: ContentType,
  key: string,
  force = false,
): void {
  if (inFlight.has(key)) return;

  const existingTimer = refreshTimers.get(key);

  if (existingTimer !== undefined) {
    if (!force) return;

    window.clearTimeout(existingTimer);
    refreshTimers.delete(key);
  }

  const snapshot = memoryCache.get(key);

  if (
    !force &&
    snapshot &&
    snapshot.rows.length > 0 &&
    Date.now() - snapshot.generatedAt <
      MIN_REFRESH_INTERVAL
  ) {
    return;
  }

  const timer = window.setTimeout(() => {
    refreshTimers.delete(key);
    void generateSnapshot(type, key);
  }, force ? 350 : EVENT_DEBOUNCE);

  refreshTimers.set(key, timer);
}

export function subscribeHomepageRecommendations(
  type: ContentType,
  listener: SnapshotListener,
): () => void {
  let active = true;

  const typeListeners =
    listeners.get(type) ??
    new Set<SnapshotListener>();

  typeListeners.add(listener);
  listeners.set(type, typeListeners);

  const key = getSnapshotKey(type);

  const load = async () => {
    const snapshot = await getPreviousSnapshot(key);

    if (!active) return;

    if (snapshot) {
      listener(snapshot);
    } else {
      listener({
        type,
        eligible: hasPersonalizationData(),
        forYou: [],
        rows: [],
        fingerprint: getActivityFingerprint(),
        generatedAt: 0,
      });
    }

    const currentFingerprint =
      getActivityFingerprint();

    const changed =
      !snapshot ||
      snapshot.fingerprint !== currentFingerprint;

    const expired =
      !snapshot ||
      Date.now() - snapshot.generatedAt > SNAPSHOT_TTL;

    /*
     * Critical regression fix:
     * Empty personalized snapshots are never considered
     * complete. Retry generation even if their fingerprint
     * and timestamp look fresh.
     */
    const missingPersonalizedRows =
      !snapshot || snapshot.rows.length === 0;

    if (
      missingPersonalizedRows ||
      changed ||
      expired
    ) {
      scheduleGeneration(
        type,
        key,
        missingPersonalizedRows,
      );
    }
  };

  void load();

  return () => {
    active = false;

    typeListeners.delete(listener);

    if (typeListeners.size === 0) {
      listeners.delete(type);
    }
  };
}

export function refreshHomepageRecommendations(
  type: ContentType,
  force = false,
): void {
  const key = getSnapshotKey(type);

  void (async () => {
    const snapshot = await getPreviousSnapshot(key);

    if (snapshot) {
      notify(type, snapshot);
    }

    const missingRows =
      !snapshot || snapshot.rows.length === 0;

    scheduleGeneration(
      type,
      key,
      force || missingRows,
    );
  })();
}

export function clearHomepageRecommendationMemory(): void {
  memoryCache.clear();
  clearHomepageGenerationCache();

  for (const timer of refreshTimers.values()) {
    window.clearTimeout(timer);
  }

  refreshTimers.clear();
}
