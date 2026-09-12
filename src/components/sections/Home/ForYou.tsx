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

type StoredTasteProfile = {
  provider?: string;
  importedAt?: string;
  version?: number;
  tasteProfile?: TasteProfile;
};

function readProfile(): TasteProfile | null {
  try {
    const raw =
      window.localStorage.getItem(
        PROFILE_KEY,
      );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(
      raw,
    ) as StoredTasteProfile | TasteProfile;

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return null;
    }

    /*
     * The Personalize page stores a wrapper:
     *
     * {
     *   provider,
     *   importedAt,
     *   version,
     *   tasteProfile: {...}
     * }
     *
     * This was the exact reason For You was
     * disappearing after the loading state.
     */
    if (
      "tasteProfile" in parsed &&
      parsed.tasteProfile &&
      typeof parsed.tasteProfile ===
        "object"
    ) {
      return parsed.tasteProfile;
    }

    /*
     * Also accept a raw TasteProfile so the
     * component remains compatible with any
     * older localStorage value.
     */
    if (
      "confidence" in parsed &&
      typeof parsed.confidence ===
        "number"
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

const ForYou: React.FC<ForYouProps> = ({
  type,
}) => {
  const [items, setItems] =
    useState<RecommendationItem[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [hasProfile, setHasProfile] =
    useState(false);

  const requestIdRef =
    useRef(0);

  useEffect(() => {
    const requestId =
      ++requestIdRef.current;

    let cancelled = false;

    const load = async () => {
      const profile =
        readProfile();

      /*
       * No personalization profile exists.
       * Hide the section only after we have
       * actually checked localStorage.
       */
      if (!profile) {
        if (
          !cancelled &&
          requestId ===
            requestIdRef.current
        ) {
          setHasProfile(false);
          setLoading(false);
        }

        return;
      }

      setHasProfile(true);

      try {
        const recommendations =
          await getPersonalizedRecommendations(
            profile,
            type,
            12,
          );

        if (
          cancelled ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        if (
          recommendations.length > 0
        ) {
          setItems(
            recommendations,
          );
        }

        setLoading(false);
      } catch {
        if (
          cancelled ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        /*
         * Keep the section alive even if
         * recommendation generation fails.
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
   * Only hide For You when we have confirmed
   * that there is genuinely no profile.
   */
  if (
    !hasProfile &&
    !loading
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

        {loading &&
        items.length === 0 ? (
          <Skeleton className="h-[250px] rounded-lg md:h-[300px]" />
        ) : items.length > 0 ? (
          <Carousel>
            {items.map((item) => (
              <div
                key={`${item.mediaType}-${item.id}`}
                className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2"
              >
                {item.mediaType ===
                "movie" ? (
                  <MoviePosterCard
                    movie={
                      item as never
                    }
                  />
                ) : (
                  <TvShowPosterCard
                    tv={
                      item as never
                    }
                  />
                )}
              </div>
            ))}
          </Carousel>
        ) : (
          <div className="flex h-[250px] items-center justify-center rounded-lg bg-default-100/40 md:h-[300px]">
            <span className="text-sm text-default-500">
              Finding something for you...
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default ForYou;
