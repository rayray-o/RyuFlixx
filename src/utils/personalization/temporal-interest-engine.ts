
export type TemporalSignal = {
  timestamp: string;
  weight: number;
};

export type TemporalWeightResult = {
  weight: number;
  shortTermInfluence: number;
  longTermInfluence: number;
  recencyInfluence: number;
};

const SHORT_TERM_HALF_LIFE_DAYS = 21;
const LONG_TERM_HALF_LIFE_DAYS = 180;

const SHORT_TERM_BLEND = 0.45;
const LONG_TERM_BLEND = 0.55;

const MINIMUM_RETAINED_INFLUENCE = 0.3;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getAgeDays(
  timestamp: string,
  now: number,
): number {
  const parsed = new Date(timestamp).getTime();

  if (!Number.isFinite(parsed)) {
    return 365;
  }

  return Math.max(0, (now - parsed) / 86400000);
}

function getDecay(
  ageDays: number,
  halfLifeDays: number,
): number {
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Balances recent interest with durable long-term taste.
 *
 * Recent signals receive stronger short-term influence,
 * while older signals retain a meaningful baseline.
 */
export function getTemporalInterestWeight(
  signal: TemporalSignal,
  now = Date.now(),
): TemporalWeightResult {
  const baseWeight = Number.isFinite(signal.weight)
    ? Math.max(0, signal.weight)
    : 0;

  const ageDays = getAgeDays(signal.timestamp, now);

  const shortTermInfluence = getDecay(
    ageDays,
    SHORT_TERM_HALF_LIFE_DAYS,
  );

  const longTermInfluence = getDecay(
    ageDays,
    LONG_TERM_HALF_LIFE_DAYS,
  );

  const blendedInfluence =
    shortTermInfluence * SHORT_TERM_BLEND +
    longTermInfluence * LONG_TERM_BLEND;

  const recencyInfluence = clamp(
    MINIMUM_RETAINED_INFLUENCE +
      blendedInfluence *
        (1 - MINIMUM_RETAINED_INFLUENCE),
    MINIMUM_RETAINED_INFLUENCE,
    1,
  );

  return {
    weight: baseWeight * recencyInfluence,
    shortTermInfluence,
    longTermInfluence,
    recencyInfluence,
  };
}

/**
 * Applies temporal weighting to a collection of signals.
 * The original signal data is preserved.
 */
export function applyTemporalInterestWeights<
  T extends TemporalSignal,
>(
  signals: T[],
  now = Date.now(),
): Array<T & TemporalWeightResult> {
  return signals.map((signal) => ({
    ...signal,
    ...getTemporalInterestWeight(signal, now),
  }));
}
