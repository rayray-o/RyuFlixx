"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AnimeWatchHistory,
  getAnimeHistoryEventName,
  getAnimeWatchHistory,
} from "@/utils/animeHistory";

function getProgress(
  item: AnimeWatchHistory,
) {
  if (
    item.duration <= 0 ||
    item.current_time <= 0
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      (item.current_time /
        item.duration) *
        100,
    ),
  );
}

function formatTime(
  seconds: number,
) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "0:00";
  }

  const totalSeconds =
    Math.floor(seconds);

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
        60,
    );

  const remaining =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes,
    ).padStart(2, "0")}:${String(
      remaining,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(
    remaining,
  ).padStart(2, "0")}`;
}

export default function AnimeContinueWatching() {
  const [history, setHistory] =
    useState<AnimeWatchHistory[]>(
      [],
    );

  useEffect(() => {
    const refresh = () => {
      setHistory(
        getAnimeWatchHistory(),
      );
    };

    refresh();

    const eventName =
      getAnimeHistoryEventName();

    window.addEventListener(
      eventName,
      refresh,
    );

    window.addEventListener(
      "storage",
      refresh,
    );

    return () => {
      window.removeEventListener(
        eventName,
        refresh,
      );

      window.removeEventListener(
        "storage",
        refresh,
      );
    };
  }, []);

  const items = useMemo(() => {
    return history
      .filter(
        (item) =>
          !item.completed &&
          item.current_time > 0,
      )
      .slice(0, 12);
  }, [history]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-warning">
            Pick up where you left off
          </p>

          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Continue Watching
          </h2>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
        {items.map((item) => {
          const progress =
            getProgress(item);

          const image =
            item.poster ||
            item.image;

          return (
            <Link
              key={item.key}
              href={`/anime/${encodeURIComponent(
                item.anime_id,
              )}/watch?episode=${
                item.episode
              }`}
              className="group w-[150px] shrink-0 sm:w-[170px] md:w-[190px]"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
                {image ? (
                  <img
                    src={image}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">
                    No Image
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent" />

                <div className="absolute bottom-3 left-3 right-3">
                  <span className="rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Episode {item.episode}
                  </span>
                </div>
              </div>

              <div className="mt-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-white transition-colors group-hover:text-warning">
                  {item.title}
                </h3>

                <div className="mt-1 flex items-center justify-between text-[11px] text-white/40">
                  <span>
                    {formatTime(
                      item.current_time,
                    )}
                  </span>

                  {item.duration >
                    0 && (
                    <span>
                      {formatTime(
                        item.duration,
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-warning transition-all"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
