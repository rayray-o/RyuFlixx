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
  clearGorseInspiredRecommendationCache,
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
const MAX_STALE_AGE = 7 * 24 * 60 * 60 * 1000;

type HomepageSnapshot = {
  type: ContentType;
  eligible: boolean;
  forYou: RecommendationItem[];
  rows: HomepageRow[];
  fingerprint: string;
  generatedAt: number;
};

type SnapshotListener = (snapshot: HomepageSnapshot) => void;

const memoryCache = new Map<string, HomepageSnapshot>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Map<ContentType, Set<SnapshotListener>>();

let databasePromise: Promise<IDBDatabase | null> | null = null;

function readProfile(): TasteProfile | null {
  try {
    const raw = localStorage.getItem("ryuflix_taste_profile");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (parsed?.tasteProfile) {
      return parsed.tasteProfile as TasteProfile;
    }

    if (typeof parsed?.confidence === "number") {
      return parsed as TasteProfile;
    }

    return null;
  } catch {
    return null;
  }
}

function hasTasteSignals(profile: TasteProfile | null): boolean {
  if (!profile?.preferences) return false;

  return Object.values(profile.preferences).some((signals) =>
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
    return (
      getWatchHistory().length > 0 ||
      getLocalWatchlist().length > 0 ||
      getAllExplicitFeedback().length > 0 ||
      hasTasteSignals(readProfile())
    );
  } catch {
    return false;
  }
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
    return localStorage.getItem("ryuflix_active_profile_v1") ?? "default";
  } catch {
    return "default";
  }
}

function getSnapshotKey(type: ContentType): string {
  return `${type}:${hash(getProfileKey())}`;
}

function getActivityFingerprint(): string {
  try {
    return hash(
      JSON.stringify({
        history: getWatchHistory(),
        watchlist: getLocalWatchlist(),
        feedback: getAllExplicitFeedback(),
        taste: localStorage.getItem("ryuflix_taste_profile"),
      }),
    );
  } catch {
    return "unavailable";
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
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

      const request = transaction.objectStore(STORE_NAME).get(key);

      request.onsuccess = () => {
        const result = request.result as
          | { key: string; snapshot: HomepageSnapshot }
          | undefined;

        resolve(result?.snapshot ?? null);
      };

      request.onerror = () => resolve(null);
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
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    // The in-memory snapshot remains usable if IndexedDB fails.
  }
}

function notify(
  type: ContentType,
  snapshot: HomepageSnapshot,
): void {
  for (const listener of listeners.get(type) ?? []) {
    try {
      listener(snapshot);
    } catch {
      // One component must not interrupt other subscribers.
    }
  }
}

async function generateSnapshot(
  type: ContentType,
  key: string,
): Promise<void> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const job = (async () => {
    const profile = readProfile();
    const eligible = hasPersonalizationData();

    let recommendations: RecommendationItem[] = [];
    let rows: HomepageRow[] = [];

    if (eligible) {
      recommendations = await getGorseInspiredRecommendations(
        type,
        30,
        profile,
      );

      // Both homepage sections share this exact recommendation pool.
      clearHomepageGenerationCache();

      rows = await generateHomepageRows(
        type,
        recommendations,
      );
    }

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

    const snapshot: HomepageSnapshot = {
      type,
      eligible,
      forYou: recommendations
        .filter(
          (item) =>
            !excluded.has(`${item.mediaType}:${item.id}`),
        )
        .slice(0, 12),
      rows,
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
  } finally {
    if (inFlight.get(key) === job) {
      inFlight.delete(key);
    }
  }
}

export function subscribeHomepageRecommendations(
  type: ContentType,
  listener: SnapshotListener,
): () => void {
  let active = true;

  const typeListeners = listeners.get(type) ?? new Set();
  typeListeners.add(listener);
  listeners.set(type, typeListeners);

  const key = getSnapshotKey(type);

  const deliver = (snapshot: HomepageSnapshot | null) => {
    if (!active || !snapshot) return;

    memoryCache.set(key, snapshot);
    listener(snapshot);
  };

  const load = async () => {
    let snapshot = memoryCache.get(key) ?? null;

    if (!snapshot) {
      snapshot = await readPersistentSnapshot(key);
    }

    if (!active) return;

    deliver(snapshot);

    const fingerprint = getActivityFingerprint();

    const age = snapshot
      ? Date.now() - snapshot.generatedAt
      : Infinity;

    const changed =
      !snapshot || snapshot.fingerprint !== fingerprint;

    const expired = age > SNAPSHOT_TTL;
    const unusablyOld = age > MAX_STALE_AGE;

    if (!snapshot || changed || expired) {
      void generateSnapshot(type, key);
    }

    // If the saved snapshot is too old, don't leave it displayed
    // indefinitely while a new one is being generated.
    if (unusablyOld && active) {
      listener({
        type,
        eligible: hasPersonalizationData(),
        forYou: [],
        rows: [],
        fingerprint,
        generatedAt: 0,
      });
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
): void {
  const key = getSnapshotKey(type);
  void generateSnapshot(type, key);
}

export function clearHomepageRecommendationMemory(): void {
  memoryCache.clear();
  clearHomepageGenerationCache();
  clearGorseInspiredRecommendationCache();
}
