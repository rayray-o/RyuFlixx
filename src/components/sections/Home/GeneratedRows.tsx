"use client";

import CinematicMediaCard from "@/components/sections/Home/CinematicMediaCard";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import { siteConfig } from "@/config/site";
import type { ContentType } from "@/types";
import type { HomepageRow } from "@/utils/personalization/homepage-generation-engine";
import {
  refreshHomepageRecommendations,
  subscribeHomepageRecommendations,
} from "@/utils/personalization/homepage-recommendation-service";
import { PROFILE_UPDATED_EVENT } from "@/utils/profiles";
import { Skeleton } from "@heroui/react";
import type { Movie, TV } from "tmdb-ts/dist/types";
import { useEffect, useRef, useState } from "react";

interface GeneratedRowsProps {
  type: ContentType;
}

type Media = Movie | TV;

type BaselineRow = {
  id: string;
  title: string;
  items: Media[];
};

type QueryEntry = {
  name: string;
  query: () => Promise<{ results?: Media[] }>;
};

const BASELINE_TTL = 30 * 60 * 1000;

const baselineCache = new Map<
  ContentType,
  {
    expiresAt: number;
    rows: BaselineRow[];
  }
>();

const baselineInFlight = new Map<
  ContentType,
  Promise<BaselineRow[]>
>();

async function loadBaselineRows(
  type: ContentType,
): Promise<BaselineRow[]> {
  const cached = baselineCache.get(type);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const existing = baselineInFlight.get(type);
  if (existing) return existing;

  const job = (async () => {
    const source =
      type === "movie"
        ? siteConfig.queryLists.movies
        : siteConfig.queryLists.tvShows;

    const entries = source as unknown as QueryEntry[];

    const results = await Promise.all(
      entries.map(async (entry, index) => {
        try {
          const response = await entry.query();

          return {
            id: `baseline-${type}-${index}`,
            title: entry.name,
            items: Array.isArray(response?.results)
              ? response.results
              : [],
          };
        } catch {
          return {
            id: `baseline-${type}-${index}`,
            title: entry.name,
            items: [],
          };
        }
      }),
    );

    const rows = results.filter(
      (row) => row.items.length >= 4,
    );

    baselineCache.set(type, {
      expiresAt: Date.now() + BASELINE_TTL,
      rows,
    });

    return rows;
  })();

  baselineInFlight.set(type, job);

  try {
    return await job;
  } finally {
    if (baselineInFlight.get(type) === job) {
      baselineInFlight.delete(type);
    }
  }
}

const GeneratedRows: React.FC<GeneratedRowsProps> = ({ type }) => {
  const [rows, setRows] = useState<HomepageRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<BaselineRow[]>([]);
  const [baselineLoaded, setBaselineLoaded] = useState(false);

  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    const currentRequest = ++requestId.current;

    // Restore baseline shelves immediately from the session cache.
    const cachedBaseline = baselineCache.get(type);

    if (cachedBaseline && cachedBaseline.expiresAt > Date.now()) {
      setBaselineRows(cachedBaseline.rows);
      setBaselineLoaded(true);
    } else {
      setBaselineLoaded(false);
    }

    // Baseline loading is independent of personalization.
    void loadBaselineRows(type).then((result) => {
      if (!active || currentRequest !== requestId.current) return;

      setBaselineRows(result);
      setBaselineLoaded(true);
    });

    // Personalized rows subscribe to the same shared snapshot
    // as For You. No separate recommendation job is started here.
    const unsubscribe = subscribeHomepageRecommendations(
      type,
      (snapshot) => {
        if (!active) return;
        setRows(snapshot.rows);
      },
    );

    const refresh = () => {
      refreshHomepageRecommendations(type);
    };

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === "ryuflix_taste_profile" ||
        event.key === "ryuflix_active_profile_v1" ||
        event.key === "ryuflix_watch_history_v1" ||
        event.key === "ryuflix_watchlist_v1"
      ) {
        refresh();
      }
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("ryuflix-history-updated", refresh);
    window.addEventListener("ryuflix-watchlist-updated", refresh);

    return () => {
      active = false;
      requestId.current += 1;
      unsubscribe();

      window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ryuflix-history-updated", refresh);
      window.removeEventListener("ryuflix-watchlist-updated", refresh);
    };
  }, [type]);

  const showBaselineSkeleton =
    !baselineLoaded && baselineRows.length === 0;

  return (
    <>
      {rows.map((row) => (
        <section
          key={row.id}
          id={`generated-${row.id}`}
          className="relative py-5 md:py-7 lg:py-9"
        >
          <div className="mb-4 px-5 md:px-10 lg:px-14 2xl:px-20">
            <SectionTitle>{row.title}</SectionTitle>
          </div>

          <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14 2xl:pl-20">
            <Carousel
              classNames={{
                wrapper: "justify-start",
                container: "gap-0",
              }}
            >
              {row.items.map((item) => (
                <div
                  key={`${item.mediaType}-${item.id}`}
                  className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
                >
                  <CinematicMediaCard media={item} />
                </div>
              ))}
            </Carousel>
          </div>
        </section>
      ))}

      {showBaselineSkeleton &&
        [0, 1, 2].map((section) => (
          <section
            key={`${type}-baseline-skeleton-${section}`}
            className="relative py-5 md:py-7 lg:py-9"
          >
            <div className="mb-4 px-5 md:px-10 lg:px-14 2xl:px-20">
              <Skeleton className="h-7 w-44 rounded-full" />
            </div>

            <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14 2xl:pl-20">
              <div className="flex gap-3 overflow-hidden pb-3 md:gap-4 lg:gap-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="aspect-[16/10] w-[185px] shrink-0 rounded-xl sm:w-[210px] lg:w-[270px] xl:w-[310px] 2xl:w-[350px]"
                  />
                ))}
              </div>
            </div>
          </section>
        ))}

      {baselineRows.map((row) => (
        <section
          key={row.id}
          id={row.id}
          className="relative py-5 md:py-7 lg:py-9"
        >
          <div className="mb-4 px-5 md:px-10 lg:px-14 2xl:px-20">
            <SectionTitle>{row.title}</SectionTitle>
          </div>

          <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14 2xl:pl-20">
            <Carousel
              classNames={{
                wrapper: "justify-start",
                container: "gap-0",
              }}
            >
              {row.items.map((item) => (
                <div
                  key={`${type}-${item.id}`}
                  className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
                >
                  <CinematicMediaCard media={item} />
                </div>
              ))}
            </Carousel>
          </div>
        </section>
      ))}
    </>
  );
};

export default GeneratedRows;
