"use client";

import MoviePosterCard from "@/components/sections/Movie/Cards/Poster";
import TvShowPosterCard from "@/components/sections/TV/Cards/Poster";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import type { ContentType } from "@/types";
import type { TasteProfile } from "@/utils/personalization/taste-engine";
import {
  getPersonalizedRecommendations,
  type RecommendationItem,
} from "@/utils/personalization/recommendation-engine";
import { Skeleton } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

const PROFILE_KEY = "ryuflix_taste_profile";

function readProfile(): TasteProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as TasteProfile;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

const ForYou: React.FC<{
  type: ContentType;
}> = ({ type }) => {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);

  /*
   * Prevent an older request from replacing a newer
   * successful recommendation result.
   */
  const requestIdRef = useRef(0);

  /*
   * Once we have successfully displayed a personalized
   * result, never destroy it just because a later request
   * temporarily returns nothing.
   */
  const hasLoadedRecommendationsRef = useRef(false);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    const load = async () => {
      const profile = readProfile();

      if (!profile || profile.confidence < 8) {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }

        return;
      }

      /*
       * Only show the loading state if we don't already
       * have a usable personalized result.
       */
      if (!hasLoadedRecommendationsRef.current) {
        setLoading(true);
      }

      try {
        const recommendations =
          await getPersonalizedRecommendations(
            profile,
            type,
            12,
          );

        if (
          cancelled ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        /*
         * CRITICAL:
         *
         * An empty response is NOT allowed to erase
         * recommendations that have already loaded.
         *
         * This prevents the exact disappearing-row bug.
         */
        if (recommendations.length > 0) {
          hasLoadedRecommendationsRef.current = true;
          setItems(recommendations);
        }

        setLoading(false);
      } catch {
        if (
          cancelled ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        /*
         * Never erase working recommendations because
         * TMDB temporarily failed or returned an error.
         */
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [type]);

  /*
   * No personalized profile = no For You section.
   *
   * But once recommendations have successfully loaded,
   * the section remains mounted permanently for this
   * page session.
   */
  if (
    !loading &&
    items.length === 0 &&
    !hasLoadedRecommendationsRef.current
  ) {
    return null;
  }

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
        ) : (
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
        )}
      </div>
    </section>
  );
};

export default ForYou;
