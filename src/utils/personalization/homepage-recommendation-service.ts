
"use client";

import { env } from "@/utils/env";
import type { ContentType } from "@/types";
import {
  getWatchHistory,
  getLocalWatchlist,
} from "@/utils/localStorage";
import {
  getGorseInspiredRecommendations,
} from "@/utils/personalization/gorse-inspired-engine";
import type { RecommendationItem } from "@/utils/personalization/recommendation-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";
import { getProfileStorageKey } from "@/utils/profiles";
import { getAllExplicitFeedback } from "@/utils/personalization/explicit-feedback-engine";

const BASE_URL = "https://api.themoviedb.org/3";
const CACHE_TTL = 10 * 60 * 1000;
const MAX_ROWS = 9;
const ROW_SIZE = 18;
const REQUEST_TIMEOUT = 5000;

type RawItem = Record<string, unknown>;

export type HomepageRow = {
  id: string;
  title: string;
  reason: string;
  items: RecommendationItem[];
  affinity: number;
  family: "genre" | "language" | "country" | "discovery";
};

type RowCandidate = {
  id: string;
  title: string;
  reason: string;
  family: HomepageRow["family"];
  affinity: number;
  params: Record<string, string>;
};

type TasteSignal = {
  name: string;
  score: number;
  id?: number;
};

type InterestData = {
  genres: TasteSignal[];
  languages: TasteSignal[];
  countries: TasteSignal[];
};

type CachedRows = {
  expiresAt: number;
  rows: HomepageRow[];
};

const cache = new Map<string, CachedRows>();
const inFlight = new Map<string, Promise<HomepageRow[]>>();

const MOVIE_GENRES: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Science Fiction": 878,
  Thriller: 53,
  War: 10752,
  Western: 37,
};

const TV_GENRES: Record<string, number> = {
  Action: 10759,
  Adventure: 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 10765,
  History: 10768,
  Horror: 9648,
  Music: 10463,
  Mystery: 9648,
  Romance: 18,
  "Science Fiction": 10765,
  Thriller: 9648,
  War: 10768,
  Western: 37,
};

const GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
  10768: "War & Politics",
  10463: "Music",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ko: "Korean",
  ja: "Japanese",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  bn: "Bengali",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  zh: "Chinese",
  th: "Thai",
  tr: "Turkish",
  ar: "Arabic",
  ru: "Russian",
  pt: "Portuguese",
};

const LANGUAGE_CODES: Record<string, string> = {
  english: "en",
  hindi: "hi",
  korean: "ko",
  japanese: "ja",
  tamil: "ta",
  telugu: "te",
  malayalam: "ml",
  bengali: "bn",
  french: "fr",
  spanish: "es",
  german: "de",
  italian: "it",
  chinese: "zh",
  thai: "th",
  turkish: "tr",
  arabic: "ar",
  russian: "ru",
  portuguese: "pt",
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  IN: "India",
  KR: "South Korea",
  JP: "Japan",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  CN: "China",
  TH: "Thailand",
  TR: "Turkey",
  CA: "Canada",
  AU: "Australia",
};

const COUNTRY_CODES: Record<string, string> = {
  "united states": "US",
  usa: "US",
  america: "US",
  india: "IN",
  "south korea": "KR",
  korea: "KR",
  japan: "JP",
  "united kingdom": "GB",
  uk: "GB",
  france: "FR",
  germany: "DE",
  spain: "ES",
  italy: "IT",
  china: "CN",
  thailand: "TH",
  turkey: "TR",
  canada: "CA",
  australia: "AU",
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}

function getTasteProfile(): TasteProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      "ryuflix_taste_profile",
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.tasteProfile
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

function addSignal(
  map: Map<string, TasteSignal>,
  name: string,
  score: number,
  id?: number,
): void {
  const cleanName = name.trim();

  if (!cleanName || !Number.isFinite(score) || score <= 0) {
    return;
  }

  const key = normalize(cleanName);
  const existing = map.get(key);

  if (existing) {
    existing.score += score;

    if (!existing.id && id) {
      existing.id = id;
    }

    return;
  }

  map.set(key, {
    name: cleanName,
    score,
    id,
  });
}

function getProfileInterests(
  profile: TasteProfile | null,
): InterestData {
  const genres = new Map<string, TasteSignal>();
  const languages = new Map<string, TasteSignal>();
  const countries = new Map<string, TasteSignal>();

  if (!profile) {
    return {
      genres: [],
      languages: [],
      countries: [],
    };
  }

  for (const [name, score] of Object.entries(
    profile.preferences?.genres ?? {},
  )) {
    addSignal(genres, name, score);
  }

  for (const [name, score] of Object.entries(
    profile.preferences?.languages ?? {},
  )) {
    addSignal(languages, name, score);
  }

  for (const [name, score] of Object.entries(
    profile.preferences?.countries ?? {},
  )) {
    addSignal(countries, name, score);
  }

  for (const item of profile.topGenres ?? []) {
    addSignal(
      genres,
      item.name,
      item.score,
      item.id,
    );
  }

  for (const item of profile.topKeywords ?? []) {
    void item;
  }

  return {
    genres: [...genres.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8),
    languages: [...languages.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
    countries: [...countries.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  };
}

function enrichInterestsFromRecommendations(
  interests: InterestData,
  recommendations: RecommendationItem[],
  type: ContentType,
): InterestData {
  const genres = new Map<string, TasteSignal>();
  const languages = new Map<string, TasteSignal>();
  const countries = new Map<string, TasteSignal>();

  for (const item of interests.genres) {
    addSignal(genres, item.name, item.score, item.id);
  }

  for (const item of interests.languages) {
    addSignal(languages, item.name, item.score);
  }

  for (const item of interests.countries) {
    addSignal(countries, item.name, item.score);
  }

  recommendations.forEach((item, index) => {
    if (item.mediaType !== type) return;

    const weight = Math.max(
      0.25,
      1.5 - index * 0.035,
    );

    for (const genreId of item.genre_ids ?? []) {
      const name = GENRE_NAMES[genreId];

      if (name) {
        addSignal(genres, name, weight, genreId);
      }
    }

    if (item.original_language) {
      addSignal(
        languages,
        item.original_language.toLowerCase(),
        weight,
      );
    }
  });

  return {
    genres: [...genres.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8),
    languages: [...languages.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
    countries: [...countries.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  };
}

function getGenreId(
  type: ContentType,
  name: string,
  knownId?: number,
): number | null {
  if (knownId && knownId > 0) {
    return knownId;
  }

  const genres =
    type === "movie"
      ? MOVIE_GENRES
      : TV_GENRES;

  const normalized = normalize(name);

  const match = Object.entries(genres).find(
    ([genre]) => normalize(genre) === normalized,
  );

  return match ? match[1] : null;
}

function getLanguageCode(name: string): string | null {
  const normalized = normalize(name);

  if (/^[a-z]{2}$/.test(normalized)) {
    return normalized;
  }

  return LANGUAGE_CODES[normalized] ?? null;
}

function getCountryCode(name: string): string | null {
  const normalized = normalize(name);

  if (/^[a-z]{2}$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  return COUNTRY_CODES[normalized] ?? null;
}

function buildRowCandidates(
  type: ContentType,
  interests: InterestData,
): RowCandidate[] {
  const rows: RowCandidate[] = [];
  const seen = new Set<string>();

  const add = (candidate: RowCandidate) => {
    if (seen.has(candidate.id)) return;

    seen.add(candidate.id);
    rows.push(candidate);
  };

  for (const genre of interests.genres) {
    const id = getGenreId(
      type,
      genre.name,
      genre.id,
    );

    if (!id) continue;

    add({
      id: `personalized-genre-${id}`,
      title: `More ${genre.name}`,
      reason: `Based on your interest in ${genre.name.toLowerCase()}.`,
      family: "genre",
      affinity: genre.score,
      params: {
        with_genres: String(id),
      },
    });
  }

  for (const language of interests.languages) {
    const code = getLanguageCode(language.name);

    if (!code) continue;

    const displayName =
      LANGUAGE_NAMES[code] ?? language.name;

    add({
      id: `personalized-language-${code}`,
      title:
        code === "hi"
          ? "Hindi Cinema"
          : `${displayName} Language Picks`,
      reason: "Selected from your language preferences.",
      family: "language",
      affinity: language.score,
      params: {
        with_original_language: code,
      },
    });
  }

  for (const country of interests.countries) {
    const code = getCountryCode(country.name);

    if (!code) continue;

    const displayName =
      COUNTRY_NAMES[code] ?? country.name;

    add({
      id: `personalized-country-${code}`,
      title: `${displayName} Cinema`,
      reason: "More titles from a country you watch.",
      family: "country",
      affinity: country.score,
      params: {
        with_origin_country: code,
      },
    });
  }

  const genres = rows.filter((row) => row.family === "genre");
  const languages = rows.filter((row) => row.family === "language");
  const countries = rows.filter((row) => row.family === "country");

  const selected: RowCandidate[] = [
    ...genres.slice(0, 4),
    ...languages.slice(0, 3),
    ...countries.slice(0, 2),
  ];

  return selected
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, MAX_ROWS);
}

function getHistoryIds(): Set<string> {
  const ids = new Set<string>();

  try {
    for (const item of getWatchHistory()) {
      ids.add(`${item.type}:${item.media_id}`);
    }
  } catch {
    // History is optional.
  }

  try {
    for (const item of getLocalWatchlist()) {
      ids.add(`${item.type}:${item.id}`);
    }
  } catch {
    // Watchlist is optional.
  }

  return ids;
}

function getRawTitle(
  item: RawItem,
  type: ContentType,
): RecommendationItem | null {
  const id = Number(item.id);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    mediaType: type,
    title:
      typeof item.title === "string"
        ? item.title
        : undefined,
    name:
      typeof item.name === "string"
        ? item.name
        : undefined,
    poster_path:
      typeof item.poster_path === "string"
        ? item.poster_path
        : null,
    backdrop_path:
      typeof item.backdrop_path === "string"
        ? item.backdrop_path
        : null,
    vote_average: Number(item.vote_average) || 0,
    vote_count: Number(item.vote_count) || 0,
    popularity: Number(item.popularity) || 0,
    release_date:
      typeof item.release_date === "string"
        ? item.release_date
        : undefined,
    first_air_date:
      typeof item.first_air_date === "string"
        ? item.first_air_date
        : undefined,
    genre_ids: Array.isArray(item.genre_ids)
      ? item.genre_ids.filter(
          (value): value is number =>
            typeof value === "number",
        )
      : [],
    overview:
      typeof item.overview === "string"
        ? item.overview
        : undefined,
    original_language:
      typeof item.original_language === "string"
        ? item.original_language
        : undefined,
  };
}

async function request<T>(
  path: string,
): Promise<T | null> {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT,
  );

  try {
    const response = await fetch(
      `${BASE_URL}${path}`,
      {
        method: "GET",
        cache: "force-cache",
        signal: controller.signal,
        headers: {
          Authorization:
            `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
          accept: "application/json",
        },
      },
    );

    if (!response.ok) return null;

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function qualityScore(
  item: RecommendationItem,
): number {
  const rating = clamp(
    item.vote_average ?? 0,
    0,
    10,
  );

  const votes = Math.max(
    0,
    item.vote_count ?? 0,
  );

  const popularity = Math.max(
    0,
    item.popularity ?? 0,
  );

  return (
    rating * 1.2 +
    Math.log10(votes + 1) * 1.1 +
    Math.log10(popularity + 1) * 0.8
  );
}

async function fetchRowItems(
  type: ContentType,
  candidate: RowCandidate,
): Promise<RecommendationItem[]> {
  const params = new URLSearchParams({
    include_adult: "false",
    sort_by: "popularity.desc",
    "vote_count.gte": "15",
    page: "1",
    ...candidate.params,
  });

  const response = await request<{
    results?: RawItem[];
  }>(
    `/discover/${type}?${params.toString()}`,
  );

  return (response?.results ?? [])
    .map((item) => getRawTitle(item, type))
    .filter(
      (item): item is RecommendationItem =>
        item !== null,
    );
}

function makeFingerprint(
  type: ContentType,
  interests: InterestData,
  recommendations: RecommendationItem[],
): string {
  return JSON.stringify({
    type,
    genres: interests.genres,
    languages: interests.languages,
    countries: interests.countries,
    recommendationIds: recommendations
      .slice(0, 30)
      .map((item) => `${item.mediaType}:${item.id}`),
  });
}

function createFallbackCandidate(): RowCandidate {
  return {
    id: "personalized-discovery",
    title: "Discover Something New",
    reason: "A selection to help expand your interests.",
    family: "discovery",
    affinity: 0,
    params: {},
  };
}

async function buildRows(
  type: ContentType,
  candidates: RowCandidate[],
  recommendations: RecommendationItem[],
): Promise<HomepageRow[]> {
  const personalizedRank = new Map<string, number>();

  recommendations.forEach((item, index) => {
    personalizedRank.set(
      `${item.mediaType}:${item.id}`,
      index,
    );
  });

  const excluded = getHistoryIds();
  const usedAcrossPage = new Set<string>();

  // Fetch at most three personalized shelves simultaneously.
  const fetchedRows: Array<{
    candidate: RowCandidate;
    items: RecommendationItem[];
  }> = new Array(candidates.length);

  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;

      if (index >= candidates.length) return;

      const candidate = candidates[index];

      fetchedRows[index] = {
        candidate,
        items: await fetchRowItems(type, candidate),
      };
    }
  };

  const workerCount = Math.min(3, candidates.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  const rows: HomepageRow[] = [];

  for (const result of fetchedRows) {
    if (!result) continue;

    const ranked = result.items
      .filter(
        (item) =>
          !excluded.has(`${item.mediaType}:${item.id}`),
      )
      .map((item) => {
        const key = `${item.mediaType}:${item.id}`;
        const learnedRank = personalizedRank.get(key);

        const algorithmScore =
          learnedRank === undefined
            ? 0
            : Math.max(0, 60 - learnedRank * 1.5);

        return {
          item,
          score:
            algorithmScore +
            qualityScore(item) +
            result.candidate.affinity * 0.08,
        };
      })
      .sort((a, b) => b.score - a.score);

    const selected: RecommendationItem[] = [];
    const selectedKeys: string[] = [];

    for (const entry of ranked) {
      const key = `${entry.item.mediaType}:${entry.item.id}`;

      if (usedAcrossPage.has(key)) continue;

      selected.push(entry.item);
      selectedKeys.push(key);

      if (selected.length >= ROW_SIZE) break;
    }

    // Only reserve titles after the row passes validation.
    if (selected.length < 4) continue;

    for (const key of selectedKeys) {
      usedAcrossPage.add(key);
    }

    rows.push({
      id: result.candidate.id,
      title: result.candidate.title,
      reason: result.candidate.reason,
      items: selected,
      affinity: result.candidate.affinity,
      family: result.candidate.family,
    });
  }

  const familyOrder = {
    genre: 0,
    language: 1,
    country: 2,
    discovery: 3,
  };

  rows.sort((a, b) => {
    if (familyOrder[a.family] !== familyOrder[b.family]) {
      return familyOrder[a.family] - familyOrder[b.family];
    }

    return b.affinity - a.affinity;
  });

  return rows;
}

/**
 * Generates personalized homepage shelves.
 * Reuses the supplied recommendation pool when available.
 */
export async function generateHomepageRows(
  type: ContentType,
  suppliedRecommendations?: RecommendationItem[],
): Promise<HomepageRow[]> {
  const profile = getTasteProfile();

  const recommendations =
    suppliedRecommendations ??
    await getGorseInspiredRecommendations(
      type,
      30,
      profile,
    );

  const profileInterests =
    getProfileInterests(profile);

  const interests =
    enrichInterestsFromRecommendations(
      profileInterests,
      recommendations,
      type,
    );

  let candidates = buildRowCandidates(
    type,
    interests,
  );

  if (candidates.length === 0) {
    candidates = [createFallbackCandidate()];
  }

  const key = makeFingerprint(
    type,
    interests,
    recommendations,
  );

  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const existing = inFlight.get(key);

  if (existing) {
    return existing;
  }

  const job = buildRows(
    type,
    candidates,
    recommendations,
  ).then((rows) => {
    if (rows.length > 0) {
      cache.set(key, {
        expiresAt: Date.now() + CACHE_TTL,
        rows,
      });
    }

    return rows;
  });

  inFlight.set(key, job);

  try {
    return await job;
  } finally {
    if (inFlight.get(key) === job) {
      inFlight.delete(key);
    }
  }
}

export function clearHomepageGenerationCache(): void {
  cache.clear();
}

export type HomepageRecommendationSnapshot = {
  eligible: boolean;
  forYou: RecommendationItem[];
  rows: HomepageRow[];
};

type HomepageRecommendationListener = (
  snapshot: HomepageRecommendationSnapshot,
) => void;

type HomepageRecommendationCacheEntry = {
  expiresAt: number;
  snapshot: HomepageRecommendationSnapshot;
};

const HOMEPAGE_RECOMMENDATION_TTL = 5 * 60 * 1000;
const HOMEPAGE_STORAGE_KEY = "ryuflix_homepage_recommendations_v2";

const homepageRecommendationCache = new Map<
  string,
  HomepageRecommendationCacheEntry
>();

const homepageRecommendationInFlight = new Map<
  string,
  Promise<void>
>();

const homepageRecommendationListeners = new Map<
  string,
  Set<HomepageRecommendationListener>
>();

function getHomepageCacheKey(type: ContentType): string {
  return `${getProfileStorageKey(HOMEPAGE_STORAGE_KEY)}:${type}`;
}

function readPersistedHomepageSnapshot(
  type: ContentType,
): HomepageRecommendationCacheEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      getHomepageCacheKey(type),
    );

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") return null;

    const entry = parsed as Partial<HomepageRecommendationCacheEntry>;
    const snapshot = entry.snapshot as
      | Partial<HomepageRecommendationSnapshot>
      | undefined;

    if (
      typeof entry.expiresAt !== "number" ||
      !snapshot ||
      typeof snapshot.eligible !== "boolean" ||
      !Array.isArray(snapshot.forYou) ||
      !Array.isArray(snapshot.rows)
    ) {
      return null;
    }

    return {
      expiresAt: entry.expiresAt,
      snapshot: snapshot as HomepageRecommendationSnapshot,
    };
  } catch {
    return null;
  }
}

function getHomepageSnapshot(
  type: ContentType,
): HomepageRecommendationCacheEntry | null {
  const key = getHomepageCacheKey(type);
  const memoryCached = homepageRecommendationCache.get(key);

  if (memoryCached) return memoryCached;

  const persisted = readPersistedHomepageSnapshot(type);

  if (persisted) {
    homepageRecommendationCache.set(key, persisted);
  }

  return persisted;
}

function publishHomepageRecommendations(
  type: ContentType,
  snapshot: HomepageRecommendationSnapshot,
): void {
  const key = getHomepageCacheKey(type);

  const entry: HomepageRecommendationCacheEntry = {
    expiresAt: Date.now() + HOMEPAGE_RECOMMENDATION_TTL,
    snapshot,
  };

  homepageRecommendationCache.set(key, entry);

  // Persist the last successful homepage across browser refreshes.
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(entry));
    }
  } catch {
    // The in-memory result remains available if storage is full.
  }

  const listeners = homepageRecommendationListeners.get(key);

  listeners?.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // One subscriber must not interrupt the others.
    }
  });
}

export function subscribeHomepageRecommendations(
  type: ContentType,
  listener: HomepageRecommendationListener,
): () => void {
  const key = getHomepageCacheKey(type);

  let listeners = homepageRecommendationListeners.get(key);

  if (!listeners) {
    listeners = new Set();
    homepageRecommendationListeners.set(key, listeners);
  }

  listeners.add(listener);

  const cached = getHomepageSnapshot(type);

  // Immediately restore cached recommendations, even if stale.
  if (cached) {
    try {
      listener(cached.snapshot);
    } catch {
      // Ignore subscriber errors.
    }
  }

  // Refresh expired data in the background without blanking it.
  if (!cached || cached.expiresAt <= Date.now()) {
    void refreshHomepageRecommendations(type);
  }

  return () => {
    listeners?.delete(listener);

    if (listeners?.size === 0) {
      homepageRecommendationListeners.delete(key);
    }
  };
}

export function refreshHomepageRecommendations(
  type: ContentType,
): Promise<void> {
  const key = getHomepageCacheKey(type);
  const existing = homepageRecommendationInFlight.get(key);

  if (existing) return existing;

  const job = (async () => {
    try {
      const profile = getTasteProfile();

      const recommendations =
        await getGorseInspiredRecommendations(
          type,
          30,
          profile,
        );

      const previous = getHomepageSnapshot(type);

      // Never erase a working homepage because of a temporary
      // empty recommendation response.
      if (
        recommendations.length === 0 &&
        previous &&
        (
          previous.snapshot.forYou.length > 0 ||
          previous.snapshot.rows.length > 0
        )
      ) {
        return;
      }

      // Reuse the exact same recommendation pool for generated rows.
      const rows = await generateHomepageRows(
        type,
        recommendations,
      );

      // Explicit feedback also establishes a user's interests.
      const hasExplicitFeedback = getAllExplicitFeedback().some(
        (feedback) => feedback.mediaType === type,
      );

      const eligible =
        recommendations.length > 0 &&
        (
          getHistoryIds().size > 0 ||
          profile !== null ||
          hasExplicitFeedback
        );

      publishHomepageRecommendations(type, {
        eligible,
        forYou: recommendations.slice(0, 12),
        rows,
      });
    } catch (error) {
      console.error(
        "[RyuFlixx] Homepage recommendations failed:",
        error,
      );

      // Keep the previous snapshot. Never clear the homepage
      // because a background refresh failed.
    }
  })();

  homepageRecommendationInFlight.set(key, job);

  void job.finally(() => {
    if (homepageRecommendationInFlight.get(key) === job) {
      homepageRecommendationInFlight.delete(key);
    }
  });

  return job;
}
