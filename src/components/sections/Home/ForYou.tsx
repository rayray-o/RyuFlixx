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
import { useInViewport } from "@mantine/hooks";
import { useEffect, useState } from "react";

const PROFILE_KEY =
  "ryuflix_taste_profile";

function readProfile():
  | TasteProfile
  | null {
  try {
    const raw =
      window.localStorage.getItem(
        PROFILE_KEY,
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw,
      ) as TasteProfile;

    if (
      !parsed ||
      typeof parsed !==
        "object"
    ) {
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
  const {
    ref,
    inViewport,
  } =
    useInViewport({
      once: true,
    });

  const [items, setItems] =
    useState<
      RecommendationItem[]
    >([]);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (!inViewport) {
      return;
    }

    let cancelled = false;

    const load =
      async () => {
        const profile =
          readProfile();

        if (
          !profile ||
          profile.confidence < 8
        ) {
          return;
        }

        setLoading(true);

        try {
          const recommendations =
            await getPersonalizedRecommendations(
              profile,
              type,
              12,
            );

          if (!cancelled) {
            setItems(
              recommendations,
            );
          }
        } catch {
          if (!cancelled) {
            setItems([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    inViewport,
    type,
  ]);

  /*
   * If personalization isn't ready,
   * the section simply doesn't exist.
   *
   * This keeps the homepage clean.
   */
  if (
    !inViewport ||
    (
      !loading &&
      items.length === 0
    )
  ) {
    return (
      <section
        ref={ref}
        className="min-h-0"
      />
    );
  }

  return (
    <section
      ref={ref}
      className="min-h-[250px] md:min-h-[300px]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionTitle>
            For You
          </SectionTitle>
        </div>

        {loading ? (
          <Skeleton
            className="h-[250px] rounded-lg md:h-[300px]"
          />
        ) : (
          <Carousel>
            {items.map(
              (item) => (
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
              ),
            )}
          </Carousel>
        )}
      </div>
    </section>
  );
};

export default ForYou;
