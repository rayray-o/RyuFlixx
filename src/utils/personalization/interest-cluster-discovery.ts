
import type { ContentType } from "@/types";
import type { FeatureVectorItem } from "@/utils/personalization/feature-vector-engine";

export type InterestDiscoverySeed = {
  item: FeatureVectorItem;
  weight: number;
};

export type InterestDiscoveryTarget = {
  id: string;
  genres: string[];
  keywords: string[];
  strength: number;
  titleCount: number;
};

type InterestCluster = {
  seeds: InterestDiscoverySeed[];
  genres: Map<string, number>;
  keywords: Map<string, number>;
  mass: number;
};

const MAX_CLUSTERS = 6;
const MAX_DISCOVERY_TARGETS = 3;
const MIN_CLUSTER_SIZE = 2;
const MIN_CLUSTER_STRENGTH = 0.35;
const MAX_GENRES_PER_CLUSTER = 2;
const MAX_KEYWORDS_PER_CLUSTER = 2;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getSeedInfluence(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }

  return clamp(
    Math.log1p(Math.min(weight, 12)) / Math.log1p(12),
    0.12,
    1,
  );
}

function getFeatureOverlap(
  left: FeatureVectorItem,
  right: FeatureVectorItem,
): number {
  const leftFeatures = new Set([
    ...left.genres.map((value) => `g:${normalize(value)}`),
    ...left.keywords.map((value) => `k:${normalize(value)}`),
  ]);

  const rightFeatures = new Set([
    ...right.genres.map((value) => `g:${normalize(value)}`),
    ...right.keywords.map((value) => `k:${normalize(value)}`),
  ]);

  if (leftFeatures.size === 0 || rightFeatures.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const feature of leftFeatures) {
    if (rightFeatures.has(feature)) {
      intersection++;
    }
  }

  const union = new Set([
    ...leftFeatures,
    ...rightFeatures,
  ]).size;

  return union > 0 ? intersection / union : 0;
}

function addFeatures(
  target: Map<string, number>,
  values: string[],
  weight: number,
): void {
  for (const value of values) {
    const key = normalize(value);

    if (!key) continue;

    target.set(
      key,
      (target.get(key) ?? 0) + weight,
    );
  }
}

function buildClusters(
  seeds: InterestDiscoverySeed[],
): InterestCluster[] {
  const ordered = seeds
    .filter(
      (seed) =>
        Number.isFinite(seed.weight) &&
        seed.weight > 0 &&
        seed.item.genres.length + seed.item.keywords.length > 0,
    )
    .sort((a, b) => b.weight - a.weight);

  const clusters: InterestCluster[] = [];

  for (const seed of ordered) {
    let bestCluster: InterestCluster | null = null;
    let bestOverlap = 0;

    for (const cluster of clusters) {
      let overlap = 0;

      for (const existing of cluster.seeds) {
        overlap = Math.max(
          overlap,
          getFeatureOverlap(seed.item, existing.item),
        );
      }

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestOverlap >= 0.16) {
      const influence = getSeedInfluence(seed.weight);

      bestCluster.seeds.push(seed);
      bestCluster.mass += influence;

      addFeatures(
        bestCluster.genres,
        seed.item.genres,
        influence,
      );

      addFeatures(
        bestCluster.keywords,
        seed.item.keywords,
        influence,
      );

      continue;
    }

    if (clusters.length >= MAX_CLUSTERS) {
      continue;
    }

    const influence = getSeedInfluence(seed.weight);

    const cluster: InterestCluster = {
      seeds: [seed],
      genres: new Map(),
      keywords: new Map(),
      mass: influence,
    };

    addFeatures(
      cluster.genres,
      seed.item.genres,
      influence,
    );

    addFeatures(
      cluster.keywords,
      seed.item.keywords,
      influence,
    );

    clusters.push(cluster);
  }

  return clusters;
}

function getTopFeatures(
  features: Map<string, number>,
  limit: number,
): string[] {
  return [...features.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

function getClusterStrength(
  cluster: InterestCluster,
  totalMass: number,
): number {
  const sizeStrength = Math.log1p(cluster.seeds.length) / Math.log(6);
  const massStrength = cluster.mass / Math.max(0.1, totalMass);

  return clamp(
    sizeStrength * 0.55 +
      Math.sqrt(massStrength) * 0.45,
    0,
    1,
  );
}

/**
 * Creates independent discovery targets from the user's
 * positive title history.
 *
 * This function does not perform network requests. It only
 * groups evidence and returns bounded, ranked targets.
 */
export function buildInterestDiscoveryTargets(
  seeds: InterestDiscoverySeed[],
  mediaType: ContentType,
): InterestDiscoveryTarget[] {
  const compatibleSeeds = seeds.filter(
    (seed) => seed.item.mediaType === mediaType,
  );

  if (compatibleSeeds.length < MIN_CLUSTER_SIZE) {
    return [];
  }

  const clusters = buildClusters(compatibleSeeds);

  const totalMass = clusters.reduce(
    (sum, cluster) => sum + cluster.mass,
    0,
  );

  return clusters
    .filter(
      (cluster) =>
        cluster.seeds.length >= MIN_CLUSTER_SIZE,
    )
    .map((cluster, index) => {
      const genres = getTopFeatures(
        cluster.genres,
        MAX_GENRES_PER_CLUSTER,
      );

      const keywords = getTopFeatures(
        cluster.keywords,
        MAX_KEYWORDS_PER_CLUSTER,
      );

      return {
        id: `interest-${index + 1}`,
        genres,
        keywords,
        strength: getClusterStrength(cluster, totalMass),
        titleCount: cluster.seeds.length,
      };
    })
    .filter(
      (target) =>
        target.strength >= MIN_CLUSTER_STRENGTH &&
        (target.genres.length > 0 ||
          target.keywords.length > 0),
    )
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_DISCOVERY_TARGETS);
}
