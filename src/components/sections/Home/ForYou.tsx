"use client";

import MoviePosterCard from "@/components/sections/Movie/Cards/Poster";
import TvShowPosterCard from "@/components/sections/TV/Cards/Poster";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import type { ContentType } from "@/types";
import type { TasteProfile } from "@/utils/personalization/taste-engine";
import {
  clearGorseInspiredRecommendationCache,
  getGorseInspiredRecommendations,
} from "@/utils/personalization/gorse-inspired-engine";
import { PROFILE_UPDATED_EVENT } from "@/utils/profiles";
import { Skeleton } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

const PROFILE_KEY = "ryuflix_taste_profile";

type StoredTasteProfile = {
  provider?: string;
  importedAt?: string;
  version?: number;
  tasteProfile?: TasteProfile;
};

function readProfile(): TasteProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(
      raw,
    ) as StoredTasteProfile | TasteProfile;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (
      "tasteProfile" in parsed &&
      parsed.tasteProfile &&
      typeof parsed.tasteProfile === "object"
    ) {
      return parsed.tasteProfile;
    }

    if (
      "confidence" in parsed &&
      typeof parsed.confidence === "number"
    ) {
      return parsed as TasteProfile;
    }

    return null;
  } catch {
    return null;
  }
}

interface ForYouProps {
  type: ContentType;
}

const ForYou: React.FC<ForYouProps> = ({ type }) => {
  const [items, setItems] = useState<
    Awaited<
      ReturnType<typeof getGorseInspiredRecommendations>
    >
  >([]);

  const [loading, setLoading] = useState(true);

  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setItems([]);

      try {
        const recommendations =
          await getGorseInspiredRecommendations(
            type,
            12,
            readProfile(),
          );

        if (
          cancelled ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setItems(recommendations);
      } catch {
        if (
          cancelled ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setItems([]);
      } finally {
        if (
          !cancelled &&
          requestId === requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    };

    const handleProfileChange = () => {
      clearGorseInspiredRecommendationCache();
      void load();
    };

    const handleStorageChange = (
      event: StorageEvent,
    ) => {
      if (
        event.key === null ||
        event.key === PROFILE_KEY ||
        event.key === "ryuflix_active_profile_v1"
      ) {
        handleProfileChange();
      }
    };

    void load();

    window.addEventListener(
      PROFILE_UPDATED_EVENT,
      handleProfileChange,
    );

    window.addEventListener(
      "storage",
      handleStorageChange,
    );

    return () => {
      cancelled = true;
      requestIdRef.current += 1;

      window.removeEventListener(
        PROFILE_UPDATED_EVENT,
        handleProfileChange,
      );

      window.removeEventListener(
        "storage",
        handleStorageChange,
      );
    };
  }, [type]);

  return (
    <section className="min-h-[250px] md:min-h-[300px]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionTitle>
            For You
          </SectionTitle>
        </div>

        {loading && items.length === 0 ? (
          <Skeleton className="h-[250px] rounded-lg md:h-[300px]" />
        ) : items.length > 0 ? (
          <Carousel>
            {items.map((item) => (
              <div
                key={`${item.mediaType}-${item.id}`}
                className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
              >
                {item.mediaType === "movie" ? (
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
        ) : (
          <div className="flex h-[250px] items-center justify-center rounded-lg bg-default-100/40 md:h-[300px]">
            <span className="text-sm text-default-500">
              Recommendations are temporarily unavailable.
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default ForYou;
