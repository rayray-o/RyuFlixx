"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

interface NextEpisodeCountdownProps {
  airingAt: number;
  episode: number;
}

function formatRemaining(
  seconds: number,
): string {
  const safe =
    Math.max(
      0,
      Math.floor(seconds),
    );

  const days =
    Math.floor(
      safe / 86400,
    );

  const hours =
    Math.floor(
      (safe % 86400) / 3600,
    );

  const minutes =
    Math.floor(
      (safe % 3600) / 60,
    );

  const secs =
    safe % 60;

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
  airingAt,
  episode,
}: NextEpisodeCountdownProps) {
  const target =
    airingAt * 1000;

  const [now, setNow] =
    useState(() =>
      Date.now(),
    );

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setNow(
            Date.now(),
          );
        },
        1000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, []);

  const remaining =
    Math.max(
      0,
      Math.floor(
        (target - now) /
          1000,
      ),
    );

  const airingDate =
    useMemo(
      () =>
        new Date(target),
      [target],
    );

  const localDate =
    useMemo(
      () =>
        new Intl.DateTimeFormat(
          undefined,
          {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        ).format(
          airingDate,
        ),
      [airingDate],
    );

  const localTime =
    useMemo(
      () =>
        new Intl.DateTimeFormat(
          undefined,
          {
            hour: "numeric",
            minute: "2-digit",
            timeZoneName:
              "short",
          },
        ).format(
          airingDate,
        ),
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

  const isAiring =
    remaining <= 0;

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-warning/15 bg-warning/[0.04]">
      <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-warning/70">
            Next Episode
          </p>

          <h2 className="mt-1 text-xl font-bold text-white">
            Episode {episode}
          </h2>

          <p className="mt-2 text-sm text-white/50">
            {isAiring
              ? "Airing now"
              : `In ${formatRemaining(
                  remaining,
                )}`}
          </p>
        </div>

        <div className="text-left md:text-right">
          <p className="text-sm font-semibold text-white/80">
            {localDate}
          </p>

          <p className="mt-1 text-sm text-warning">
            {localTime}
          </p>

          <p className="mt-1 text-[11px] text-white/30">
            {timezone}
          </p>
        </div>
      </div>
    </section>
  );
              }
