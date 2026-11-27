"use client";

import CinematicMediaCard from "@/components/sections/Home/CinematicMediaCard";
import RecommendationFeedback from "@/components/sections/Home/RecommendationFeedback";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import type { ContentType } from "@/types";
import { PROFILE_UPDATED_EVENT } from "@/utils/profiles";
import {
  refreshHomepageRecommendations,
  subscribeHomepageRecommendations,
} from "@/utils/personalization/homepage-recommendation-service";
import { EXPLICIT_FEEDBACK_UPDATED_EVENT } from "@/utils/personalization/explicit-feedback-engine";
import type { RecommendationItem } from "@/utils/personalization/recommendation-engine";
import { Skeleton } from "@heroui/react";
import { useEffect, useState } from "react";

interface ForYouProps {
  type: ContentType;
}

const ForYou: React.FC<ForYouProps> = ({ type }) => {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [eligible, setEligible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeHomepageRecommendations(
      type,
      (snapshot) => {
        if (!active) return;

        setEligible(snapshot.eligible);
        setItems(snapshot.forYou);
        setLoaded(true);
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
    window.addEventListener(EXPLICIT_FEEDBACK_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("ryuflix-history-updated", refresh);
    window.addEventListener("ryuflix-watchlist-updated", refresh);

    return () => {
      active = false;
      unsubscribe();

      window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
      window.removeEventListener(EXPLICIT_FEEDBACK_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ryuflix-history-updated", refresh);
      window.removeEventListener("ryuflix-watchlist-updated", refresh);
    };
  }, [type]);

  if (!eligible) return null;

  if (!loaded) {
    return (
      <section className="relative py-5 md:py-7 lg:py-9">
        <div className="mb-4">
          <SectionTitle>For You</SectionTitle>
        </div>

        <div className="flex gap-3 overflow-hidden pb-3 md:gap-4 lg:gap-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={`${type}-${index}`}
              className="aspect-[16/10] w-[185px] shrink-0 rounded-xl sm:w-[210px] lg:w-[270px] xl:w-[310px] 2xl:w-[350px]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="relative py-5 md:py-7 lg:py-9">
      <div className="mb-4">
        <SectionTitle>For You</SectionTitle>
      </div>

      <div className="overflow-hidden">
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
      </div>
    </section>
  );
};

export default ForYou;
