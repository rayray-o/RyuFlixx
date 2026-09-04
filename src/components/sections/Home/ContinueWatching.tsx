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
  useState,
} from "react";

const ContinueWatching: React.FC =
  () => {
    const { content } =
      useDiscoverFilters();

    const [history, setHistory] =
      useState<
        LocalWatchHistory[]
      >([]);

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
      history.filter(
        (item) =>
          item.type === content,
      );

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
