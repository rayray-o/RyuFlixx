
"use client";

import MoviePosterCard from "@/components/sections/Movie/Cards/Poster";
import TvShowPosterCard from "@/components/sections/TV/Cards/Poster";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import type { ContentType } from "@/types";
import {
  clearHomepageGenerationCache,
  generateHomepageRows,
  type HomepageRow,
} from "@/utils/personalization/homepage-generation-engine";
import { clearGorseInspiredRecommendationCache } from "@/utils/personalization/gorse-inspired-engine";
import { PROFILE_UPDATED_EVENT } from "@/utils/profiles";
import { Skeleton } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

interface GeneratedRowsProps {
  type: ContentType;
}

const GeneratedRows: React.FC<GeneratedRowsProps> = ({
  type,
}) => {
  const [rows, setRows] = useState<HomepageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const currentRequest = ++requestId.current;

      setLoading(true);

      try {
        const generated =
          await generateHomepageRows(type);

        if (
          cancelled ||
          currentRequest !== requestId.current
        ) {
          return;
        }

        setRows(generated);
      } catch {
        if (
          cancelled ||
          currentRequest !== requestId.current
        ) {
          return;
        }

        setRows([]);
      } finally {
        if (
          !cancelled &&
          currentRequest === requestId.current
        ) {
          setLoading(false);
        }
      }
    };

    const refresh = () => {
      clearHomepageGenerationCache();
      clearGorseInspiredRecommendationCache();
      void load();
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

    void load();

    window.addEventListener(
      PROFILE_UPDATED_EVENT,
      refresh,
    );

    window.addEventListener(
      "storage",
      onStorage,
    );

    window.addEventListener(
      "ryuflix-history-updated",
      refresh,
    );

    window.addEventListener(
      "ryuflix-watchlist-updated",
      refresh,
    );

    return () => {
      cancelled = true;
      requestId.current += 1;

      window.removeEventListener(
        PROFILE_UPDATED_EVENT,
        refresh,
      );

      window.removeEventListener(
        "storage",
        onStorage,
      );

      window.removeEventListener(
        "ryuflix-history-updated",
        refresh,
      );

      window.removeEventListener(
        "ryuflix-watchlist-updated",
        refresh,
      );
    };
  }, [type]);

  if (loading && rows.length === 0) {
    return (
      <>
        {[0, 1, 2].map((item) => (
          <section
            key={item}
            className="min-h-[250px] md:min-h-[300px]"
          >
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-7 w-44 rounded-full" />
            </div>
            <Skeleton className="h-[250px] rounded-lg md:h-[300px]" />
          </section>
        ))}
      </>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <section
          key={row.id}
          id={`generated-${row.id}`}
          className="min-h-[250px] md:min-h-[300px]"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionTitle>
                {row.title}
              </SectionTitle>
            </div>

            <Carousel
              classNames={
                type === "tv"
                  ? {
                      wrapper: "justify-start",
                      container: "gap-0",
                    }
                  : undefined
              }
            >
              {row.items.map((item) => (
                <div
                  key={`${item.mediaType}-${item.id}`}
                  className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
                >
                  {type === "movie" ? (
                    <MoviePosterCard
                      movie={item as never}
                    />
                  ) : (
                    <TvShowPosterCard
                      tv={item as never}
                    />
                  )}
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
