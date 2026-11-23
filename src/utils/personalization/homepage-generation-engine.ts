
"use client";

import { env } from "@/utils/env";
import type { ContentType } from "@/types";
import {
  getWatchHistory,
  getLocalWatchlist,
} from "@/utils/localStorage";
import {
  getBehavioralSignal,
} from "@/utils/personalization/behavioral-memory";
import {
  getGorseInspiredRecommendations,
  type RecommendationItem,
} from "@/utils/personalization/gorse-inspired-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const BASE_URL = "https://api.themoviedb.org/3";
const CACHE_TTL = 3 * 60 * 1000;
const MAX_ROWS = 9;
const ROW_SIZE = 18;

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

function getPositiveSignals(
  map: Record<string, number> | undefined,
  limit: number,
): TasteSignal[] {
  if (!map) return [];

  return Object.entries(map)
    .filter(
      ([name, score]) =>
        name.trim().length > 0 &&
        Number.isFinite(score) &&
        score > 0,
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, score]) => ({
      name,
      score,
    }));
}

function getProfileInterests(
  profile: TasteProfile | null,
): InterestData {
  return {
    genres: getPositiveSignals(
      profile?.preferences.genres,
      8,
    ),
    languages: getPositiveSignals(
      profile?.preferences.languages,
      5,
    ),
    countries: getPositiveSignals(
      profile?.preferences.countries,
      5,
    ),
  };
}

async function request<T>(
  path: string,
): Promise<T | null> {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    6500,
  );

  try {
    const response = await fetch(
      `${BASE_URL}${path}`,
      {
        method: "GET",
        cache: "no-store",
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

function getHistoryIds(): Set<string> {
  const ids = new Set<string>();

  for (const item of getWatchHistory()) {
    ids.add(`${item.type}:${item.media_id}`);
  }

  for (const item of getLocalWatchlist()) {
    ids.add(`${item.type}:${item.id}`);
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
    vote_average:
      Number(item.vote_average) || 0,
    vote_count:
      Number(item.vote_count) || 0,
    popularity:
      Number(item.popularity) || 0,
    release_date:
      typeof item.release_date === "string"
        ? item.release_date
        : undefined,
    first_air_date:
      typeof item.first_air_date === "string"
        ? item.first_air_date
        : undefined,
    genre_ids:
      Array.isArray(item.genre_ids)
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

/**
 * When imported taste is absent or incomplete, inspect recent
 * watched titles and derive interests from their TMDB metadata.
 */
async function learnFromWatchHistory(
  type: ContentType,
): Promise<InterestData> {
  const history = getWatchHistory()
    .filter((item) => item.type === type)
    .slice(0, 10);

  const genreScores = new Map<string, number>();
  const languageScores = new Map<string, number>();
  const countryScores = new Map<string, number>();

  const details = await Promise.all(
    history.map(async (item, index) => {
      const raw = await request<RawItem>(
        `/${type}/${item.media_id}?append_to_response=keywords`,
      );

      if (!raw) return null;

      const progress =
        item.completed
          ? 1
          : item.duration > 0
            ? clamp(
                item.last_position / item.duration,
                0,
                1,
              )
            : 0;

      const ageDays = Math.max(
        0,
        (Date.now() -
          new Date(item.updated_at).getTime()) /
          86400000,
      );

      const recency = Math.exp(-ageDays / 60);
      const behavior = getBehavioralSignal(
        item.media_id,
        type,
      );

      const weight =
        (0.6 + progress * 1.4) *
        recency *
        (1 + clamp(behavior, 0, 5) * 0.08);

      return {
        raw,
        weight,
        index,
      };
    }),
  );

  for (const result of details) {
    if (!result) continue;

    const raw = result.raw;
    const weight = result.weight;

    const genres = Array.isArray(raw.genres)
      ? raw.genres
      : [];

    for (const value of genres) {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as RawItem).name === "string"
      ) {
        const name = String((value as RawItem).name);

        genreScores.set(
          name,
          (genreScores.get(name) ?? 0) + weight,
        );
      }
    }

    const language = String(
      raw.original_language ?? "",
    ).toLowerCase();

    if (language) {
      languageScores.set(
        language,
        (languageScores.get(language) ?? 0) + weight,
      );
    }

    const countries =
      type === "tv"
        ? Array.isArray(raw.origin_country)
          ? raw.origin_country
          : []
        : Array.isArray(raw.production_countries)
          ? raw.production_countries.map((country) =>
              country &&
              typeof country === "object"
                ? (country as RawItem).iso_3166_1
                : "",
            )
          : [];

    for (const country of countries) {
      if (typeof country !== "string" || !country) {
        continue;
      }

      countryScores.set(
        country,
        (countryScores.get(country) ?? 0) + weight,
      );
    }
  }

  const toSignals = (
    map: Map<string, number>,
    limit: number,
  ): TasteSignal[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, score]) => ({
        name,
        score,
      }));

  return {
    genres: toSignals(genreScores, 8),
    languages: toSignals(languageScores, 5),
    countries: toSignals(countryScores, 5),
  };
}

function mergeInterests(
  imported: InterestData,
  learned: InterestData,
): InterestData {
  const merge = (
    first: TasteSignal[],
    second: TasteSignal[],
    limit: number,
  ): TasteSignal[] => {
    const scores = new Map<string, number>();

    for (const item of first) {
      scores.set(
        normalize(item.name),
        (scores.get(normalize(item.name)) ?? 0) +
          item.score * 1.25,
      );
    }

    for (const item of second) {
      scores.set(
        normalize(item.name),
        (scores.get(normalize(item.name)) ?? 0) +
          item.score,
      );
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, score]) => ({
        name,
        score,
      }));
  };

  return {
    genres: merge(
      imported.genres,
      learned.genres,
      8,
    ),
    languages: merge(
      imported.languages,
      learned.languages,
      5,
    ),
    countries: merge(
      imported.countries,
      learned.countries,
      5,
    ),
  };
}

function getGenreId(
  type: ContentType,
  name: string,
): number | null {
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

  for (const genre of interests.genres) {
    const id = getGenreId(type, genre.name);

    if (!id) continue;

    rows.push({
      id: `genre-${id}`,
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

    rows.push({
      id: `language-${code}`,
      title:
        code === "hi"
          ? "Hindi Cinema"
          : `${displayName} Language Picks`,
      reason: `Selected from your language preferences.`,
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

    rows.push({
      id: `country-${code}`,
      title: `${displayName} Cinema`,
      reason: `More titles from a country you watch.`,
      family: "country",
      affinity: country.score,
      params: {
        with_origin_country: code,
      },
    });
  }

  return rows
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, MAX_ROWS);
}

function qualityScore(item: RecommendationItem): number {
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

function fingerprint(
  type: ContentType,
  interests: InterestData,
): string {
  return JSON.stringify({
    type,
    genres: interests.genres,
    languages: interests.languages,
    countries: interests.countries,
  });
}

/**
 * Generates personalized homepage rows.
 *
 * The Gorse-inspired recommender supplies a learned ranking
 * across the candidate catalogue. Each shelf then applies its
 * own genre/language/country constraint, while the page selector
 * prevents the same titles from dominating multiple shelves.
 */
export async function generateHomepageRows(
  type: ContentType,
): Promise<HomepageRow[]> {
  const profile = getTasteProfile();

  const imported = getProfileInterests(profile);
  const learned = await learnFromWatchHistory(type);

  const interests = mergeInterests(
    imported,
    learned,
  );

  const key = fingerprint(type, interests);
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const personalizedPool =
    await getGorseInspiredRecommendations(
      type,
      30,
      profile,
    );

  const personalizedRank = new Map<string, number>();

  personalizedPool.forEach((item, index) => {
    personalizedRank.set(
      `${item.mediaType}:${item.id}`,
      index,
    );
  });

  let candidates = buildRowCandidates(
    type,
    interests,
  );

  // Cold-start fallback: the profile has not built enough
  // genre/language/country signals yet.
  if (candidates.length === 0) {
    candidates = [
      {
        id: "discovery-trending",
        title: "Trending Picks",
        reason: "Popular titles while we learn your taste.",
        family: "discovery",
        affinity: 0,
        params: {},
      },
    ];
  }

  const excluded = getHistoryIds();
  const usedAcrossPage = new Set<string>();

  const fetchedRows = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      items: await fetchRowItems(type, candidate),
    })),
  );

  const rows: HomepageRow[] = [];

  for (const result of fetchedRows) {
    const ranked = result.items
      .filter(
        (item) =>
          !excluded.has(`${item.mediaType}:${item.id}`),
      )
      .map((item) => {
        const key = `${item.mediaType}:${item.id}`;
        const learnedRank = personalizedRank.get(key);

        // The existing recommender's ranking is the strongest
        // personalization signal when it has evaluated this title.
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

    for (const entry of ranked) {
      const key =
        `${entry.item.mediaType}:${entry.item.id}`;

      if (usedAcrossPage.has(key)) continue;

      selected.push(entry.item);
      usedAcrossPage.add(key);

      if (selected.length >= ROW_SIZE) break;
    }

    if (selected.length < 4) continue;

    rows.push({
      id: result.candidate.id,
      title: result.candidate.title,
      reason: result.candidate.reason,
      items: selected,
      affinity: result.candidate.affinity,
      family: result.candidate.family,
    });
  }

  // The strongest interest shelves appear first, but keep a
  // mixture of row families instead of stacking one family.
  rows.sort((a, b) => {
    const familyOrder = {
      genre: 0,
      language: 1,
      country: 2,
      discovery: 3,
    };

    if (
      familyOrder[a.family] !==
      familyOrder[b.family]
    ) {
      return (
        familyOrder[a.family] -
        familyOrder[b.family]
      );
    }

    return b.affinity - a.affinity;
  });

  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL,
    rows,
  });

  return rows;
}

export function clearHomepageGenerationCache(): void {
  cache.clear();
}
