"use client";

import BackToTopButton from "@/components/ui/button/BackToTopButton";
import SectionTitle from "@/components/ui/other/SectionTitle";
import {
  clearWatchHistory,
  getWatchHistory,
  LocalWatchHistory,
  removeWatchHistory,
} from "@/utils/localStorage";
import { Trash } from "@/utils/icons";
import {
  Button,
  Chip,
  Image,
} from "@heroui/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getImageUrl } from "@/utils/movies";

type Filter = "all" | "movie" | "tv";

const HistoryList: React.FC = () => {
  const [history, setHistory] = useState<
    LocalWatchHistory[]
  >([]);

  const [filter, setFilter] =
    useState<Filter>("all");

  const refresh = useCallback(() => {
    setHistory(getWatchHistory());
  }, []);

  useEffect(() => {
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
  }, [refresh]);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (filter === "all") return true;
      return item.type === filter;
    });
  }, [history, filter]);

  const handleRemove = (
    media: LocalWatchHistory,
  ) => {
    removeWatchHistory(
      media.media_id,
      media.type,
      media.season,
      media.episode,
    );
  };

  const handleClear = () => {
    clearWatchHistory();
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <SectionTitle>
            Watch History
          </SectionTitle>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All"],
                ["movie", "Movies"],
                ["tv", "TV Shows"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={
                  filter === value
                    ? "solid"
                    : "flat"
                }
                color={
                  filter === value
                    ? "warning"
                    : "default"
                }
                onPress={() =>
                  setFilter(value)
                }
              >
                {label}
              </Button>
            ))}

            {filteredHistory.length > 0 && (
              <Button
                size="sm"
                color="danger"
                variant="shadow"
                startContent={<Trash />}
                onPress={handleClear}
              >
                Clear History
              </Button>
            )}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="flex min-h-[35vh] items-center justify-center">
            <p className="text-center text-default-500">
              You haven't finished watching
              anything yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHistory.map((media) => {
              const href =
                media.type === "movie"
                  ? `/movie/${media.media_id}/player`
                  : `/tv/${media.media_id}/${media.season}/${media.episode}/player`;

              const image = getImageUrl(
                media.backdrop_path ||
                  media.poster_path ||
                  "",
              );

              const watchedDate =
                new Date(
                  media.updated_at,
                );

              return (
                <div
                  key={media.key}
                  className="group relative overflow-hidden rounded-xl border border-foreground-100 bg-content1"
                >
                  <Link href={href}>
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        src={image}
                        alt={media.title}
                        radius="none"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />

                      <Chip
                        size="sm"
                        color="success"
                        variant="solid"
                        className="absolute left-3 top-3"
                      >
                        Completed
                      </Chip>

                      {media.type === "tv" &&
                        media.season &&
                        media.episode && (
                          <Chip
                            size="sm"
                            color="warning"
                            variant="solid"
                            className="absolute right-3 top-3"
                          >
                            S{media.season} E
                            {media.episode}
                          </Chip>
                        )}

                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="truncate font-bold">
                          {media.title}
                        </h3>

                        <p className="text-xs opacity-70">
                          Watched{" "}
                          {watchedDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    aria-label={`Remove ${media.title} from history`}
                    title="Remove from history"
                    onClick={() =>
                      handleRemove(media)
                    }
                    className="absolute right-3 bottom-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-lg font-bold text-white backdrop-blur-sm transition hover:bg-danger"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BackToTopButton />
    </>
  );
};

export default HistoryList;
