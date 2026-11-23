"use client";

import CinematicMediaCard from "@/components/sections/Home/CinematicMediaCard";
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

    window.addEventListener("storage", onStorage);

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

      window.removeEventListener("storage", onStorage);

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
        {[0, 1, 2].map((section) => (
          <section
            key={section}
            className="relative py-5 md:py-7 lg:py-9"
          >
            <div className="mb-4 px-5 md:px-10 lg:px-14 2xl:px-20">
              <Skeleton className="h-7 w-44 rounded-full" />
            </div>

            <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14 2xl:pl-20">
              <div className="flex gap-3 overflow-hidden pb-3 md:gap-4 lg:gap-5 2xl:gap-6">
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
      </>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <section
          key={row.id}
          id={`generated-${row.id}`}
          className="relative py-5 md:py-7 lg:py-9"
        >
          <div className="mb-4 px-5 md:px-10 lg:px-14 2xl:px-20">
            <SectionTitle>
              {row.title}
            </SectionTitle>
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
                  <CinematicMediaCard
                    media={item as never}
                  />
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
