"use client";

import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import {
  getWatchHistory,
  LocalWatchHistory,
} from "@/utils/localStorage";
import ResumeCard from "./Cards/Resume";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

const ContinueWatching: React.FC =
  () => {
    const { content } =
      useDiscoverFilters();

    const [history, setHistory] =
      useState<LocalWatchHistory[]>(
        [],
      );

    useEffect(() => {
      const refresh = () => {
        setHistory(
          getWatchHistory(),
        );
      };

      refresh();

      window.addEventListener(
        "ryuflix-history-updated",
        refresh,
      );

      window.addEventListener(
        "storage",
        refresh,
      );

      return () => {
        window.removeEventListener(
          "ryuflix-history-updated",
          refresh,
        );

        window.removeEventListener(
          "storage",
          refresh,
        );
      };
    }, []);

    const filteredHistory =
      useMemo(() => {
        /*
         * Completed items do not belong in
         * Continue Watching.
         */
        const unfinished =
          history.filter(
            (item) =>
              item.type === content &&
              !item.completed,
          );

        /*
         * Movies naturally have one history
         * record per movie.
         */
        if (content === "movie") {
          return unfinished;
        }

        /*
         * TV:
         *
         * A show can have:
         *
         * S1E1
         * S1E2
         * S1E3
         * S2E1
         *
         * Instead of displaying four cards,
         * display only the latest unfinished
         * episode for that show.
         *
         * History is already sorted newest first,
         * so the first episode we encounter for
         * a show is the one we want.
         */
        const latestByShow =
          new Map<
            number,
            LocalWatchHistory
          >();

        for (
          const item of unfinished
        ) {
          if (
            !latestByShow.has(
              item.media_id,
            )
          ) {
            latestByShow.set(
              item.media_id,
              item,
            );
          }
        }

        return Array.from(
          latestByShow.values(),
        );
      }, [history, content]);

    if (
      filteredHistory.length === 0
    ) {
      return null;
    }

    return (
      <section
        id="continue-watching"
        className="min-h-[250px] md:min-h-[300px]"
      >
        <div className="z-3 flex flex-col gap-2">
          <SectionTitle
            color={
              content === "movie"
                ? "primary"
                : "warning"
            }
          >
            Continue Watching
          </SectionTitle>

          <Carousel>
            {filteredHistory.map(
              (media) => (
                <div
                  key={media.key}
                  className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
                >
                  <ResumeCard
                    media={media}
                  />
                </div>
              ),
            )}
          </Carousel>
        </div>
      </section>
    );
  };

export default ContinueWatching;
