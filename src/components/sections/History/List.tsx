
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
import { Button, Image } from "@heroui/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getImageUrl } from "@/utils/movies";

type Filter = "all" | "movie" | "tv";

function getHistoryCardKey(item: LocalWatchHistory) {
  return item.type === "tv"
    ? `tv-${item.media_id}`
    : `movie-${item.media_id}`;
}

/**
 * The history is episode-based internally.
 * The UI is series-based: only the newest episode
 * watched for each series is displayed.
 */
function groupHistoryByTitle(
  history: LocalWatchHistory[],
): LocalWatchHistory[] {
  const grouped = new Map<string, LocalWatchHistory>();

  for (const item of history) {
    const key = getHistoryCardKey(item);
    const existing = grouped.get(key);

    if (
      !existing ||
      new Date(item.updated_at).getTime() >
        new Date(existing.updated_at).getTime()
    ) {
      grouped.set(key, item);
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) =>
      new Date(b.updated_at).getTime() -
      new Date(a.updated_at).getTime(),
  );
}

function formatWatchedDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface HistoryCardProps {
  media: LocalWatchHistory;
  onRemove: (media: LocalWatchHistory) => void;
}

function HistoryCard({
  media,
  onRemove,
}: HistoryCardProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const isTv = media.type === "tv";

  const href = isTv
    ? `/tv/${media.media_id}/${media.season}/${media.episode}/player`
    : `/movie/${media.media_id}/player`;

  const image = getImageUrl(
    media.backdrop_path || media.poster_path || "",
  );

  const watchedDate = formatWatchedDate(media.updated_at);

  const episodeLabel =
    isTv && media.season && media.episode
      ? `SEASON ${media.season} · EPISODE ${media.episode}`
      : "";

  useEffect(() => {
    const element = titleRef.current;

    if (!element) return;

    const measure = () => {
      const text = element.querySelector(
        ".history-title-text",
      ) as HTMLElement | null;

      if (!text) return;

      setShouldScroll(
        text.scrollWidth > element.clientWidth + 4,
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [media.title]);

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-content1 transition duration-300 hover:border-white/20">
      <Link
        href={href}
        className="relative block aspect-video overflow-hidden"
        aria-label={`Continue ${media.title}`}
      >
        <Image
          src={image}
          alt={media.title}
          radius="none"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          classNames={{
            wrapper: "absolute inset-0 !h-full !w-full",
          }}
        />

        {/* Subtle image treatment */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          {/* Type and episode context */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/75 backdrop-blur-md">
              {isTv ? "TV Series" : "Movie"}
            </span>

            {episodeLabel && (
              <span className="text-[10px] font-semibold tracking-[0.12em] text-white/70">
                {episodeLabel}
              </span>
            )}
          </div>

          {/* Cinematic title */}
          <div
            ref={titleRef}
            className="history-title-viewport w-full overflow-hidden"
          >
            <div
              className={[
                "history-title-track",
                shouldScroll ? "is-scrolling" : "",
              ].join(" ")}
            >
              <span className="history-title-text">
                {media.title.toUpperCase()}
              </span>

              {shouldScroll && (
                <span
                  className="history-title-text"
                  aria-hidden="true"
                >
                  {media.title.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Watched context */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.17em] text-white/60 sm:text-xs">
              Watched {watchedDate}
            </span>

            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">
              {media.completed ? "Completed" : "In progress"}
            </span>
          </div>
        </div>
      </Link>

      {/* Remove */}
      <button
        type="button"
        aria-label={`Remove ${media.title} from history`}
        title="Remove from history"
        onClick={() => onRemove(media)}
        className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-xl font-semibold text-white backdrop-blur-md transition hover:border-white/30 hover:bg-danger"
      >
        ×
      </button>
    </article>
  );
}

const HistoryList: React.FC = () => {
  const [history, setHistory] = useState<
    LocalWatchHistory[]
  >([]);

  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(() => {
    setHistory(getWatchHistory());
  }, []);

  useEffect(() => {
    refresh();

    window.addEventListener(
      "ryuflix-history-updated",
      refresh,
    );

    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(
        "ryuflix-history-updated",
        refresh,
      );

      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const filteredHistory = useMemo(() => {
    const filtered = history.filter((item) => {
      if (filter === "all") return true;
      return item.type === filter;
    });

    return groupHistoryByTitle(filtered);
  }, [history, filter]);

  const handleRemove = (media: LocalWatchHistory) => {
    if (media.type === "tv") {
      // Removing a series removes all its episode entries.
      const seriesEntries = history.filter(
        (item) =>
          item.type === "tv" &&
          item.media_id === media.media_id,
      );

      for (const entry of seriesEntries) {
        removeWatchHistory(
          entry.media_id,
          entry.type,
          entry.season,
          entry.episode,
        );
      }

      return;
    }

    removeWatchHistory(
      media.media_id,
      media.type,
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
                  filter === value ? "solid" : "flat"
                }
                color={
                  filter === value ? "warning" : "default"
                }
                onPress={() => setFilter(value)}
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
              You haven't watched anything yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHistory.map((media) => (
              <HistoryCard
                key={getHistoryCardKey(media)}
                media={media}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .history-title-viewport {
          position: relative;
          white-space: nowrap;
        }

        .history-title-track {
          display: flex;
          width: max-content;
          align-items: center;
          gap: 3rem;
        }

        .history-title-text {
          flex: none;
          color: rgba(255, 255, 255, 0.88);
          font-family: "Druk Wide", Impact, "Arial Black",
            sans-serif;
          font-size: clamp(15px, 2vw, 21px);
          font-weight: 900;
          letter-spacing: 0.105em;
          line-height: 1.2;
          text-transform: uppercase;
        }

        .history-title-track.is-scrolling {
          animation: history-title-marquee 13s linear infinite;
        }

        .history-title-viewport:hover
          .history-title-track.is-scrolling {
          animation-play-state: paused;
        }

        @keyframes history-title-marquee {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(
              calc(-50% - 1.5rem)
            );
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .history-title-track.is-scrolling {
            animation: none;
          }
        }
      `}</style>

      <BackToTopButton />
    </>
  );
};

export default HistoryList;
