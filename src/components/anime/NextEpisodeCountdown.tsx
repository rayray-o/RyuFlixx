"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

interface NextEpisodeCountdownProps {
  malId: string | number;
  initialAiringAt?: number | null;
  initialEpisode?: number | null;
}

interface AiringData {
  airingAt: number;
  episode: number;
}

function isValidAiring(
  airingAt?: number | null,
  episode?: number | null,
): boolean {
  return (
    Number.isFinite(airingAt) &&
    (airingAt ?? 0) > 0 &&
    Number.isFinite(episode) &&
    (episode ?? 0) > 0
  );
}

function formatRemaining(
  seconds: number,
): string {
  const safe = Math.max(
    0,
    Math.floor(seconds),
  );

  const days = Math.floor(
    safe / 86400,
  );

  const hours = Math.floor(
    (safe % 86400) / 3600,
  );

  const minutes = Math.floor(
    (safe % 3600) / 60,
  );

  const secs = safe % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(
      2,
      "0",
    )}h ${String(minutes).padStart(
      2,
      "0",
    )}m`;
  }

  return `${String(hours).padStart(
    2,
    "0",
  )}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(secs).padStart(
    2,
    "0",
  )}`;
}

export default function NextEpisodeCountdown({
  malId,
  initialAiringAt,
  initialEpisode,
}: NextEpisodeCountdownProps) {
  const hasInitialAiring =
    isValidAiring(
      initialAiringAt,
      initialEpisode,
    );

  const [airing, setAiring] =
    useState<AiringData | null>(
      hasInitialAiring
        ? {
            airingAt:
              initialAiringAt!,
            episode:
              initialEpisode!,
          }
        : null,
    );

  const [loading, setLoading] =
    useState(!hasInitialAiring);

  const [now, setNow] =
    useState(() =>
      Date.now(),
    );

  useEffect(() => {
    let cancelled = false;

    async function loadAiring() {
      try {
        const response =
          await fetch(
            `/api/anime/${encodeURIComponent(
              String(malId),
            )}/airing`,
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as {
            airingAt?:
              | number
              | null;

            episode?:
              | number
              | null;
          };

        if (
          !cancelled &&
          isValidAiring(
            data.airingAt,
            data.episode,
          )
        ) {
          setAiring({
            airingAt:
              data.airingAt!,
            episode:
              data.episode!,
          });
        }
      } catch {
        /*
         * If the refresh fails, keep the
         * server-provided initial value.
         */
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAiring();

    const interval =
      window.setInterval(
        loadAiring,
        5 * 60 * 1000,
      );

    return () => {
      cancelled = true;

      window.clearInterval(
        interval,
      );
    };
  }, [malId]);

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setNow(Date.now());
        },
        1000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, []);

  const target =
    airing
      ? airing.airingAt * 1000
      : 0;

  const remaining =
    airing
      ? Math.max(
          0,
          Math.floor(
            (target - now) /
              1000,
          ),
        )
      : 0;

  const airingDate =
    useMemo(
      () =>
        airing
          ? new Date(target)
          : null,
      [airing, target],
    );

  const localDate =
    useMemo(
      () =>
        airingDate
          ? new Intl.DateTimeFormat(
              undefined,
              {
                weekday:
                  "short",
                month:
                  "short",
                day: "numeric",
                year:
                  "numeric",
              },
            ).format(
              airingDate,
            )
          : "",
      [airingDate],
    );

  const localTime =
    useMemo(
      () =>
        airingDate
          ? new Intl.DateTimeFormat(
              undefined,
              {
                hour:
                  "numeric",
                minute:
                  "2-digit",
                timeZoneName:
                  "short",
              },
            ).format(
              airingDate,
            )
          : "",
      [airingDate],
    );

  const timezone =
    useMemo(
      () =>
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone,
      [],
    );

  /*
   * Don't leave an empty countdown box
   * on anime that genuinely have no
   * upcoming airing schedule.
   */
  if (
    loading &&
    !airing
  ) {
    return (
      <section className="mt-8 rounded-2xl border border-warning/10 bg-warning/[0.025]">
        <div className="p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-warning/50">
            Next Episode
          </p>

          <p className="mt-2 text-sm text-white/35">
            Checking the airing
            schedule…
          </p>
        </div>
      </section>
    );
  }

  if (!airing) {
    return null;
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-warning/15 bg-warning/[0.04]">
      <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-warning/70">
            Next Episode
          </p>

          <h2 className="mt-1 text-xl font-bold text-white">
            Episode{" "}
            {airing.episode}
          </h2>

          <p className="mt-2 text-sm text-white/45">
            {remaining <= 0
              ? "Airing now"
              : `In ${formatRemaining(
                  remaining,
                )}`}
          </p>
        </div>

        <div className="md:text-right">
          <p className="text-sm font-semibold text-white/80">
            {localDate}
          </p>

          <p className="mt-1 text-sm font-semibold text-warning">
            {localTime}
          </p>

          <p className="mt-1 text-[11px] text-white/25">
            {timezone}
          </p>
        </div>
      </div>
    </section>
  );
  }
