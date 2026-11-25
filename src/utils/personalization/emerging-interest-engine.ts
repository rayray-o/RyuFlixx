
import type { ContentType } from "@/types";
import type { FeatureVectorItem } from "@/utils/personalization/feature-vector-engine";
import type { InterestDiscoveryTarget } from "@/utils/personalization/interest-cluster-discovery";

export type EmergingInterestSeed = {
  item: FeatureVectorItem;
  weight: number;
  timestamp: string;
};

type FeatureEvidence = {
  type: "genre" | "keyword";
  name: string;
  recent: Map<string, number>;
  historical: Map<string, number>;
};

type RankedEmergingFeature = {
  type: "genre" | "keyword";
  name: string;
  titleCount: number;
  strength: number;
  score: number;
};

const RECENT_WINDOW_DAYS = 30;
const BASELINE_WINDOW_DAYS = 180;

const MIN_RECENT_TITLES = 2;
const MIN_RECENT_MASS = 0.8;
const MIN_EMERGING_LIFT = 1.35;

const MAX_EMERGING_TARGETS = 2;
const MAX_KEYWORDS_PER_TITLE = 8;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getAgeDays(
  timestamp: string,
  now: number,
): number | null {
  const parsed = new Date(timestamp).getTime();

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, (now - parsed) / 86400000);
}

function getFeatureEvidence(
  item: FeatureVectorItem,
  weight: number,
  target: Map<string, FeatureEvidence>,
  period: "recent" | "historical",
): void {
  const features = [
    ...item.genres.map((name) => ({
      type: "genre" as const,
      name,
    })),
    ...item.keywords
      .slice(0, MAX_KEYWORDS_PER_TITLE)
      .map((name) => ({
        type: "keyword" as const,
        name,
      })),
  ];

  const titleKey = `${item.mediaType}:${item.id}`;

  for (const feature of features) {
    const normalized = normalize(feature.name);

    if (!normalized) continue;

    const key = `${feature.type}:${normalized}`;

    let evidence = target.get(key);

    if (!evidence) {
      evidence = {
        type: feature.type,
        name: feature.name.trim(),
        recent: new Map(),
        historical: new Map(),
      };

      target.set(key, evidence);
    }

    const bucket =
      period === "recent"
        ? evidence.recent
        : evidence.historical;

    bucket.set(
      titleKey,
      Math.max(bucket.get(titleKey) ?? 0, weight),
    );
  }
}

function getMass(
  values: Map<string, number>,
): number {
  return [...values.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
}

/**
 * Finds features gaining momentum in recent positive viewing.
 *
 * A feature must appear across multiple distinct recent titles.
 * Its recent support is compared with older support so established
 * interests are not repeatedly mislabeled as emerging interests.
 */
export function buildEmergingInterestTargets(
  seeds: EmergingInterestSeed[],
  mediaType: ContentType,
  now = Date.now(),
): InterestDiscoveryTarget[] {
  const evidence = new Map<string, FeatureEvidence>();

  const uniqueSeeds = new Map<
    string,
    EmergingInterestSeed
  >();

  for (const seed of seeds) {
    if (
      seed.item.mediaType !== mediaType ||
      !Number.isFinite(seed.item.id) ||
      !Number.isFinite(seed.weight) ||
      seed.weight < 0.2
    ) {
      continue;
    }

    const ageDays = getAgeDays(seed.timestamp, now);

    if (ageDays === null || ageDays > BASELINE_WINDOW_DAYS) {
      continue;
    }

    const key = `${seed.item.mediaType}:${seed.item.id}`;
    const existing = uniqueSeeds.get(key);

    if (!existing || seed.weight > existing.weight) {
      uniqueSeeds.set(key, seed);
    }
  }

  let recentTitleCount = 0;

  for (const seed of uniqueSeeds.values()) {
    const ageDays = getAgeDays(seed.timestamp, now);

    if (ageDays === null) continue;

    const weight = clamp(seed.weight, 0.1, 2.5);

    if (ageDays <= RECENT_WINDOW_DAYS) {
      recentTitleCount++;

      getFeatureEvidence(
        seed.item,
        weight,
        evidence,
        "recent",
      );
    } else {
      getFeatureEvidence(
        seed.item,
        weight,
        evidence,
        "historical",
      );
    }
  }

  if (recentTitleCount < MIN_RECENT_TITLES) {
    return [];
  }

  const emerging: RankedEmergingFeature[] = [];

  for (const feature of evidence.values()) {
    const recentCount = feature.recent.size;

    if (recentCount < MIN_RECENT_TITLES) {
      continue;
    }

    const recentMass = getMass(feature.recent);

    if (recentMass < MIN_RECENT_MASS) {
      continue;
    }

    const historicalCount = feature.historical.size;
    const historicalMass = getMass(feature.historical);

    const recentDensity = recentMass / recentCount;

    const historicalDensity =
      historicalCount > 0
        ? historicalMass / historicalCount
        : 0;

    const lift =
      recentDensity / (historicalDensity + 0.18);

    if (lift < MIN_EMERGING_LIFT) {
      continue;
    }

    const momentum = Math.log1p(recentCount);

    const specificityBoost =
      feature.type === "keyword" ? 1.12 : 1;

    const score =
      recentDensity *
      momentum *
      Math.min(lift, 4) *
      specificityBoost;

    const strength = clamp(
      0.35 +
        Math.min(1.5, Math.log1p(recentCount - 1) * 0.18) +
        Math.min(1.2, Math.log1p(lift) * 0.12),
      0.35,
      0.92,
    );

    emerging.push({
      type: feature.type,
      name: feature.name,
      titleCount: recentCount,
      strength,
      score,
    });
  }

  emerging.sort((a, b) => b.score - a.score);

  const selected: RankedEmergingFeature[] = [];
  const selectedKeys = new Set<string>();

  // Prefer a mixture of genres and specific keywords when possible.
  for (const feature of emerging) {
    if (selected.length >= MAX_EMERGING_TARGETS) break;

    const key = `${feature.type}:${normalize(feature.name)}`;

    if (selectedKeys.has(key)) continue;

    if (
      selected.length === 1 &&
      selected[0].type === feature.type &&
      emerging.some(
        (candidate) =>
          candidate.type !== feature.type &&
          !selectedKeys.has(
            `${candidate.type}:${normalize(candidate.name)}`,
          ),
      )
    ) {
      continue;
    }

    selected.push(feature);
    selectedKeys.add(key);
  }

  return selected.map((feature, index) => ({
    id: `emerging-${feature.type}-${index + 1}`,
    genres:
      feature.type === "genre"
        ? [feature.name]
        : [],
    keywords:
      feature.type === "keyword"
        ? [feature.name]
        : [],
    strength: feature.strength,
    titleCount: feature.titleCount,
  }));
}
