import type {
  PlayerSource,
  SourceHealth,
} from "./playerSources";

/**
 * Result returned by a source health check.
 */
export type PlayerHealthResult = SourceHealth & {
  reason?: string;
};

/**
 * Checks whether an authorized player source can be reached.
 *
 * This is intentionally conservative:
 * - It does NOT bypass CORS.
 * - It does NOT attempt to access another site's
 *   internal video element.
 * - It only checks sources that RyuFlix is authorized
 *   to access.
 */
export async function checkPlayerSource(
  source: PlayerSource,
  timeoutMs = 5000,
): Promise<PlayerHealthResult> {
  const startedAt = performance.now();

  if (!source.authorized) {
    return {
      sourceId: source.id,
      available: false,
      checkedAt: Date.now(),
      reason: "Source is not authorized for RyuFlix.",
    };
  }

  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(source.url, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });

    const latencyMs = Math.round(
      performance.now() - startedAt,
    );

    return {
      sourceId: source.id,
      available: response.ok,
      checkedAt: Date.now(),
      latencyMs,
      reason: response.ok
        ? undefined
        : `HTTP ${response.status}`,
    };
  } catch (error) {
    const latencyMs = Math.round(
      performance.now() - startedAt,
    );

    return {
      sourceId: source.id,
      available: false,
      checkedAt: Date.now(),
      latencyMs,
      reason:
        error instanceof DOMException &&
        error.name === "AbortError"
          ? "Request timed out."
          : "Source could not be reached.",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Check several authorized sources.
 *
 * Sources are checked concurrently so a slow source
 * doesn't unnecessarily delay the others.
 */
export async function checkPlayerSources(
  sources: PlayerSource[],
  timeoutMs = 5000,
): Promise<PlayerHealthResult[]> {
  return Promise.all(
    sources.map((source) =>
      checkPlayerSource(source, timeoutMs),
    ),
  );
}

/**
 * Pick the best healthy source.
 *
 * Higher priority wins.
 * If priorities are equal, lower latency wins.
 */
export function chooseHealthySource(
  sources: PlayerSource[],
  health: PlayerHealthResult[],
): PlayerSource | null {
  const healthy = sources
    .filter((source) => source.authorized)
    .map((source) => {
      const result = health.find(
        (item) => item.sourceId === source.id,
      );

      if (!result?.available) {
        return null;
      }

      return {
        source,
        latency: result.latencyMs ?? Infinity,
      };
    })
    .filter(
      (
        item,
      ): item is {
        source: PlayerSource;
        latency: number;
      } => item !== null,
    );

  healthy.sort((a, b) => {
    const priorityDifference =
      b.source.priority - a.source.priority;

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return a.latency - b.latency;
  });

  return healthy[0]?.source ?? null;
    }
