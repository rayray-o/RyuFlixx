"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useScrollIntoView } from "@mantine/hooks";
import { Spinner } from "@heroui/react";
import type { tmdb } from "@/api/tmdb";

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

type TVShowDetails = Awaited<
  ReturnType<typeof tmdb.tvShows.details>
>;

interface TVShowDetailClientProps {
  tv: TVShowDetails;
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
