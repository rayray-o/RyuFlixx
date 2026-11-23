
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
import { Button } from "@heroui/react";
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

  if (Number.isNaN(parsed.getTime())) return "";

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

  // The grouped History record is the source of truth.
  // It represents the most recently updated episode for this series.
  const hasEpisodeInfo =
    isTv &&
    typeof media.season === "number" &&
    typeof media.episode === "number";

  const episodeLabel = hasEpisodeInfo
    ? `Season ${media.season} • Episode ${media.episode}`
    : "";

  // Open the media detail page, never the player directly.
  const href = isTv
    ? `/tv/${media.media_id}`
    : `/movie/${media.media_id}`;

  const image = getImageUrl(
    media.backdrop_path || media.poster_path || "",
  );

  const watchedDate = formatWatchedDate(media.updated_at);

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

    const text = element.querySelector(
      ".history-title-text",
    );

    if (text) observer.observe(text);

    return () => observer.disconnect();
  }, [media.title]);

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-content1 transition duration-300 hover:border-white/20">
      <Link
        href={href}
        className="relative block aspect-video overflow-hidden"
        aria-label={`View details for ${media.title}`}
      >
        {image ? (
          <img
            src={image}
            alt={media.title}
            loading="lazy"
            className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 z-0 bg-neutral-900" />
        )}

        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-4 sm:p-5">
          <div
            ref={titleRef}
            className="history-title-viewport w-full overflow-hidden"
          >
            <div
              className={`history-title-track ${
                shouldScroll ? "is-scrolling" : ""
              }`}
            >
              <span className="history-title-text">
                {(media.title || "Untitled").toUpperCase()}
              </span>

              {shouldScroll && (
                <span
                  className="history-title-text"
                  aria-hidden="true"
                >
                  {(media.title || "Untitled").toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {hasEpisodeInfo && (
            <div className="mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80 sm:text-xs">
                {episodeLabel}
              </span>
            </div>
          )}

          <div className="mt-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.17em] text-white/60 sm:text-xs">
              Watched {watchedDate}
            </span>
          </div>
        </div>
      </Link>

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

    window.addEventListener(
      "ryuflix-tv-continuation-updated",
      refresh,
    );

    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(
        "ryuflix-history-updated",
        refresh,
      );

      window.removeEventListener(
        "ryuflix-tv-continuation-updated",
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

    removeWatchHistory(media.media_id, media.type);
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
                onPress={clearWatchHistory}
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

      <BackToTopButton />

      <style jsx global>{`
        @font-face {
          font-family: "RyuDrukWide";
          src: url("/DrukWideBold.ttf") format("truetype");
          font-style: normal;
          font-weight: 700 900;
          font-display: swap;
        }

        .history-title-viewport {
          position: relative;
          width: 100%;
          overflow: hidden;
          white-space: nowrap;
        }

        .history-title-track {
          display: flex;
          width: max-content;
          align-items: center;
          gap: 3rem;
        }

        .history-title-text {
          display: block;
          flex: none;
          color: rgba(255, 255, 255, 0.86);
          font-family: "RyuDrukWide", Impact, sans-serif;
          font-size: clamp(15px, 2vw, 21px);
          font-weight: 900;
          letter-spacing: 0.055em;
          line-height: 1.25;
          text-transform: uppercase;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
        }

        .history-title-track.is-scrolling {
          animation: history-title-marquee 13s linear infinite;
          will-change: transform;
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
    </>
  );
};

export default HistoryList;
