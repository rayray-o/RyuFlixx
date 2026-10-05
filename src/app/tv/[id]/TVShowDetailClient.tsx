"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useScrollIntoView } from "@mantine/hooks";
import { Spinner } from "@heroui/react";
import { TvShowDetails } from "tmdb-ts/dist/types/tv-shows";
import { AppendToResponse } from "tmdb-ts/dist/types/options";

const PhotosSection = dynamic(
  () =>
    import(
      "@/components/ui/other/PhotosSection"
    ),
);

const TvShowRelatedSection = dynamic(
  () =>
    import(
      "@/components/sections/TV/Details/Related"
    ),
);

const TvShowCastsSection = dynamic(
  () =>
    import(
      "@/components/sections/TV/Details/Casts"
    ),
);

const TvShowBackdropSection = dynamic(
  () =>
    import(
      "@/components/sections/TV/Details/Backdrop"
    ),
);

const TvShowOverviewSection = dynamic(
  () =>
    import(
      "@/components/sections/TV/Details/Overview"
    ),
);

const TvShowsSeasonsSelection = dynamic(
  () =>
    import(
      "@/components/sections/TV/Details/Seasons"
    ),
);

type TVShowDetailsWithData = AppendToResponse<
  TvShowDetails,
  (
    | "images"
    | "videos"
    | "credits"
    | "keywords"
    | "recommendations"
    | "similar"
    | "reviews"
    | "watch/providers"
  )[],
  "tvShow"
>;

interface TVShowDetailClientProps {
  tv: TVShowDetailsWithData;
}

const TVShowDetailClient: React.FC<
  TVShowDetailClientProps
> = ({ tv }) => {
  const {
    scrollIntoView,
    targetRef,
  } = useScrollIntoView<HTMLDivElement>({
    duration: 500,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Suspense
        fallback={
          <Spinner
            size="lg"
            className="absolute-center"
            color="warning"
            variant="simple"
          />
        }
      >
        <div className="flex flex-col gap-10">
          <TvShowBackdropSection tv={tv} />

          <TvShowOverviewSection
            onViewEpisodesClick={() =>
              scrollIntoView({
                alignment: "center",
              })
            }
            tv={tv}
          />

          <TvShowCastsSection
            casts={tv.credits.cast}
          />

          <PhotosSection
            images={tv.images.backdrops}
            type="tv"
          />

          <TvShowsSeasonsSelection
            ref={targetRef}
            id={tv.id}
            seasons={tv.seasons}
          />

          <TvShowRelatedSection tv={tv} />
        </div>
      </Suspense>
    </div>
  );
};

export default TVShowDetailClient;
