"use client";

import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import {
  getTvContinuation,
  getWatchHistory,
  LocalWatchHistory,
  TvShowContinuation,
} from "@/utils/localStorage";
import ResumeCard from "./Cards/Resume";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

interface TvResumeItem {
  media: LocalWatchHistory;
  continuation: TvShowContinuation | null;
}

const ContinueWatching: React.FC = () => {
  const { content } = useDiscoverFilters();

  const [history, setHistory] = useState<LocalWatchHistory[]>([]);
  const [continuationVersion, setContinuationVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setHistory(getWatchHistory());
      setContinuationVersion((value) => value + 1);
    };

    refresh();

    window.addEventListener(
      "ryuflix-history-updated",
      refresh,
    );

    window.addEventListener(
      "ryuflix-tv-continuation-updated",
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
        "ryuflix-tv-continuation-updated",
        refresh,
      );

      window.removeEventListener(
        "storage",
        refresh,
      );
    };
  }, []);

  const movieHistory = useMemo(() => {
    return history.filter(
      (item) =>
        item.type === "movie" &&
        !item.completed,
    );
  }, [history]);

  const tvHistory = useMemo<TvResumeItem[]>(() => {
    /*
     * History is sorted newest first.
     *
     * For each show we keep its newest episode record,
     * including completed records. This is important because
     * a completed episode may have a saved "next episode"
     * continuation.
     */
    const latestByShow =
      new Map<number, LocalWatchHistory>();

    for (const item of history) {
      if (item.type !== "tv") continue;

      if (!latestByShow.has(item.media_id)) {
        latestByShow.set(item.media_id, item);
      }
    }

    const result: TvResumeItem[] = [];

    for (const media of latestByShow.values()) {
      const continuation =
        getTvContinuation(media.media_id);

      /*
       * If the latest history entry is completed and we have
       * a continuation, show the next episode instead.
       *
       * Otherwise keep the actual unfinished episode.
       */
      if (media.completed && continuation) {
        result.push({
          media,
          continuation,
        });
        continue;
      }

      if (!media.completed) {
        result.push({
          media,
          continuation: null,
        });
      }
    }

    return result;
  }, [history, continuationVersion]);

  const items =
    content === "movie"
      ? movieHistory
      : tvHistory;

  if (items.length === 0) {
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
          {content === "movie"
            ? movieHistory.map((media) => (
                <div
                  key={media.key}
                  className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
                >
                  <ResumeCard media={media} />
                </div>
              ))
            : tvHistory.map(
                ({ media, continuation }) => (
                  <div
                    key={media.media_id}
                    className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
                  >
                    <ResumeCard
                      media={media}
                      continuation={continuation}
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
