"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import {
  AnimeWatchHistory,
  getAnimeHistoryEventName,
  getAnimeWatchHistory,
  removeAnimeFromWatchHistory,
} from "@/utils/animeHistory";
import { PlayOutline } from "@/utils/icons";
import { timeAgo } from "@/utils/movies";

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

const AnimeContinueWatching: React.FC =
  () => {
    const [
      history,
      setHistory,
    ] =
      useState<
        AnimeWatchHistory[]
      >([]);

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

    const items =
      useMemo(() => {
        const latestByAnime =
          new Map<
            string,
            AnimeWatchHistory
          >();

        for (const item of history) {
          if (
            item.current_time <= 0
          ) {
            continue;
          }

          if (
            !latestByAnime.has(
              item.anime_id,
            )
          ) {
            latestByAnime.set(
              item.anime_id,
              item,
            );
          }
        }

        return Array.from(
          latestByAnime.values(),
        ).slice(0, 12);
      }, [history]);

    if (items.length === 0) {
      return null;
    }

    return (
      <section
        id="anime-continue-watching"
        className="min-h-[250px] md:min-h-[300px]"
      >
        <div className="z-3 flex flex-col gap-2">
          <SectionTitle color="warning">
            Continue Watching
          </SectionTitle>

          <Carousel>
            {items.map((item) => {
              const progress =
                getProgress(item);

              const image =
                item.image ||
                item.poster;

              return (
                <div
                  key={item.anime_id}
                  className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
                >
                  <div className="group relative aspect-video w-[260px] overflow-hidden rounded-lg text-white md:w-[360px]">
                    <Link
                      href={`/anime/${encodeURIComponent(
                        item.anime_id,
                      )}/watch?episode=${
                        item.episode
                      }`}
                      className="absolute inset-0 z-0"
                      aria-label={`Continue watching ${item.title}, episode ${item.episode}`}
                    >
                      {image ? (
                        <img
                          alt={item.title}
                          src={image}
                          loading="lazy"
                          className="h-full w-full object-cover object-center transition group-hover:scale-110"
                        />
                      ) : (
                        <div className="h-full w-full bg-white/5" />
                      )}

                      <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent" />

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/35 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                          <PlayOutline className="h-6 w-6 text-white" />
                        </div>
                      </div>

                      <div className="absolute left-2 top-2 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                        Episode{" "}
                        {item.episode}
                      </div>

                      <div className="absolute bottom-0 z-20 flex w-full flex-col gap-1 p-3">
                        <div className="flex items-end justify-between gap-3">
                          <h3 className="truncate text-sm font-semibold">
                            {item.title}
                          </h3>

                          <p className="shrink-0 text-xs text-white/70">
                            {timeAgo(
                              item.updated_at,
                            )}
                          </p>
                        </div>

                        <div className="flex justify-between text-xs">
                          <p>
                            {item.completed
                              ? "Finished"
                              : "Watching"}
                          </p>

                          <p>
                            {item.completed
                              ? "100%"
                              : `${Math.round(
                                  progress,
                                )}%`}
                          </p>
                        </div>
                      </div>

                      <div className="absolute bottom-0 z-30 h-1 w-full bg-white/15">
                        <div
                          className="h-full bg-warning"
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>
                    </Link>

                    <button
                      type="button"
                      aria-label={`Remove ${item.title} from Continue Watching`}
                      title="Remove from Continue Watching"
                      onClick={() =>
                        removeAnimeFromWatchHistory(
                          item.anime_id,
                        )
                      }
                      className="absolute right-2 top-2 z-40 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-lg font-bold text-white opacity-100 backdrop-blur-sm transition hover:bg-danger hover:text-white md:opacity-0 md:group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </Carousel>
        </div>
      </section>
    );
  };

export default AnimeContinueWatching;
