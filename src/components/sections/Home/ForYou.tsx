
"use client";

import CinematicMediaCard from "@/components/sections/Home/CinematicMediaCard";
import RecommendationFeedback from "@/components/sections/Home/RecommendationFeedback";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import type { ContentType } from "@/types";
import type { TasteProfile } from "@/utils/personalization/taste-engine";
import {
  clearGorseInspiredRecommendationCache,
  getGorseInspiredRecommendations,
} from "@/utils/personalization/gorse-inspired-engine";
import {
  EXPLICIT_FEEDBACK_UPDATED_EVENT,
  getAllExplicitFeedback,
} from "@/utils/personalization/explicit-feedback-engine";
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

    if (!raw) return null;

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
  const [loadedType, setLoadedType] =
    useState<ContentType | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const requestId = ++requestIdRef.current;

      setLoading(true);

      try {
        const recommendations =
          await getGorseInspiredRecommendations(
            type,
            20,
            readProfile(),
          );

        if (
          cancelled ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        const excluded = new Set(
          getAllExplicitFeedback()
            .filter(
              (feedback) =>
                feedback.value === "dislike" ||
                feedback.value === "not_interested",
            )
            .map(
              (feedback) =>
                `${feedback.mediaType}:${feedback.id}`,
            ),
        );

        const visibleRecommendations =
          recommendations.filter(
            (item) =>
              !excluded.has(
                `${item.mediaType}:${item.id}`,
              ),
          );

        setItems(visibleRecommendations.slice(0, 12));
        setLoadedType(type);
      } catch {
        if (
          cancelled ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setItems([]);
        setLoadedType(type);
      } finally {
        if (
          !cancelled &&
          requestId === requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    };

    const refresh = () => {
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
        refresh();
      }
    };

    void load();

    window.addEventListener(
      PROFILE_UPDATED_EVENT,
      refresh,
    );

    window.addEventListener(
      EXPLICIT_FEEDBACK_UPDATED_EVENT,
      refresh,
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
        refresh,
      );

      window.removeEventListener(
        EXPLICIT_FEEDBACK_UPDATED_EVENT,
        refresh,
      );

      window.removeEventListener(
        "storage",
        handleStorageChange,
      );
    };
  }, [type]);

  // Never show the previous media type while the new one loads.
  const showingCurrentType = loadedType === type;

  const showSkeleton =
    !showingCurrentType || loading;

  return (
    <section className="relative py-5 md:py-7 lg:py-9">
      <div className="mb-4">
        <SectionTitle>
          For You
        </SectionTitle>
      </div>

      <div className="overflow-hidden">
        {showSkeleton ? (
          <div className="flex gap-3 overflow-hidden pb-3 md:gap-4 lg:gap-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={`${type}-${index}`}
                className="aspect-[16/10] w-[185px] shrink-0 rounded-xl sm:w-[210px] lg:w-[270px] xl:w-[310px] 2xl:w-[350px]"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <Carousel
            classNames={{
              wrapper: "justify-start",
              container: "gap-0",
            }}
          >
            {items.map((item) => (
              <div
                key={`${item.mediaType}-${item.id}`}
                className="embla__slide flex min-h-fit max-w-fit flex-col items-stretch px-1 py-2"
              >
                <CinematicMediaCard
                  media={item}
                />

                <RecommendationFeedback
                  id={item.id}
                  mediaType={item.mediaType}
                />
              </div>
            ))}
          </Carousel>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl bg-white/[0.035]">
            <span className="text-sm text-white/45">
              Recommendations are temporarily unavailable.
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default ForYou;
