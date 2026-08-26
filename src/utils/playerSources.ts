export type PlayerSourceKind = "authorized-embed" | "direct";

export type PlayerSource = {
  id: string;
  label: string;
  url: string;
  kind: PlayerSourceKind;

  /**
   * Whether RyuFlix is allowed to use this source.
   *
   * Keep this true only for sources you control,
   * license, or otherwise have permission to embed.
   */
  authorized: boolean;

  /**
   * Optional priority.
   * Higher = preferred.
   */
  priority: number;
};

export type SourceHealth = {
  sourceId: string;
  available: boolean;
  checkedAt: number;
  latencyMs?: number;
};

/**
 * Creates the list of sources available to the player.
 *
 * IMPORTANT:
 * Only put sources here that RyuFlix is authorized
 * to use/embed.
 */
export function createPlayerSources(
  sources: PlayerSource[],
): PlayerSource[] {
  return sources
    .filter((source) => source.authorized)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Select the highest-priority source that has been
 * confirmed available.
 */
export function selectBestSource(
  sources: PlayerSource[],
  health: SourceHealth[],
): PlayerSource | null {
  const healthyIds = new Set(
    health
      .filter((result) => result.available)
      .map((result) => result.sourceId),
  );

  return (
    sources.find((source) =>
      healthyIds.has(source.id),
    ) ?? null
  );
}

/**
 * Record a source failure so the player can move on
 * to another authorized source.
 */
export function markSourceUnavailable(
  health: SourceHealth[],
  sourceId: string,
): SourceHealth[] {
  const existing = health.find(
    (item) => item.sourceId === sourceId,
  );

  if (existing) {
    return health.map((item) =>
      item.sourceId === sourceId
        ? {
            ...item,
            available: false,
            checkedAt: Date.now(),
          }
        : item,
    );
  }

  return [
    ...health,
    {
      sourceId,
      available: false,
      checkedAt: Date.now(),
    },
  ];
  }
