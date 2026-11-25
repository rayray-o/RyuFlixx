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
import {
  getLocalWatchlist,
  getWatchHistory,
} from "@/utils/localStorage";
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

    const parsed = JSON.parse(raw) as StoredTasteProfile | TasteProfile;
    if (!parsed || typeof parsed !== "object") return null;

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

function profileHasSignals(profile: TasteProfile | null): boolean {
  if (!profile?.preferences) return false;

  return Object.values(profile.preferences).some((signals) =>
    Object.values(signals ?? {}).some(
      (score) => Number.isFinite(score) && score > 0,
    ),
  );
}

function hasPersonalizationData(): boolean {
  try {
    return (
      getWatchHistory().length > 0 ||
      getLocalWatchlist().length > 0 ||
      profileHasSignals(readProfile()) ||
      getAllExplicitFeedback().length > 0
    );
  } catch {
    return profileHasSignals(readProfile());
  }
}

interface ForYouProps {
  type: ContentType;
}

const ForYou: React.FC<ForYouProps> = ({ type }) => {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof getGorseInspiredRecommendations>>
  >([]);
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedType, setLoadedType] = useState<ContentType | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const requestId = ++requestIdRef.current;
      const canPersonalize = hasPersonalizationData();

      setEligible(canPersonalize);

      if (!canPersonalize) {
        setItems([]);
        setLoadedType(type);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const recommendations = await getGorseInspiredRecommendations(
          type,
          20,
          readProfile(),
        );

        if (cancelled || requestId !== requestIdRef.current) return;

        const excluded = new Set(
          getAllExplicitFeedback()
            .filter(
              (feedback) =>
                feedback.value === "dislike" ||
                feedback.value === "not_interested",
            )
            .map((feedback) => `${feedback.mediaType}:${feedback.id}`),
        );

        const visible = recommendations.filter(
          (item) => !excluded.has(`${item.mediaType}:${item.id}`),
        );

        setItems(visible.slice(0, 12));
        setLoadedType(type);
      } catch {
        if (cancelled || requestId !== requestIdRef.current) return;
        setItems([]);
        setLoadedType(type);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    const refresh = () => {
      clearGorseInspiredRecommendationCache();
      void load();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === PROFILE_KEY ||
        event.key === "ryuflix_active_profile_v1" ||
        event.key === "ryuflix_watch_history_v1" ||
        event.key === "ryuflix_watchlist_v1"
      ) {
        refresh();
      }
    };

    void load();

    window.addEventListener(PROFILE_UPDATED_EVENT, refresh);
    window.addEventListener(EXPLICIT_FEEDBACK_UPDATED_EVENT, refresh);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("ryuflix-history-updated", refresh);
    window.addEventListener("ryuflix-watchlist-updated", refresh);

    return () => {
      cancelled = true;
      requestIdRef.current += 1;
      window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
      window.removeEventListener(EXPLICIT_FEEDBACK_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("ryuflix-history-updated", refresh);
      window.removeEventListener("ryuflix-watchlist-updated", refresh);
    };
  }, [type]);

  // Cold-start users should not see a For You heading, skeleton,
  // or "temporarily unavailable" placeholder at all.
  if (!eligible) return null;

  const showingCurrentType = loadedType === type;
  const showSkeleton = !showingCurrentType || loading;

  // If a user has data but the recommender cannot produce candidates,
  // hide this shelf instead of showing an error-shaped empty row.
  if (!showSkeleton && items.length === 0) return null;

  return (
    <section className="relative py-5 md:py-7 lg:py-9">
      <div className="mb-4">
        <SectionTitle>For You</SectionTitle>
      </div>

      <div className="overflow-hidden">
        {showSkeleton ? (
          <div className="flex gap-3 overflow-hidden pb-3 md:gap-4 md:gap-5 lg:gap-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={`${type}-${index}`}
                className="aspect-[16/10] w-[185px] shrink-0 rounded-xl sm:w-[210px] lg:w-[270px] xl:w-[310px] 2xl:w-[350px]"
              />
            ))}
          </div>
        ) : (
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
                <CinematicMediaCard media={item} />
                <RecommendationFeedback
                  id={item.id}
                  mediaType={item.mediaType}
                />
              </div>
            ))}
          </Carousel>
        )}
      </div>
    </section>
  );
};

export default ForYou;
