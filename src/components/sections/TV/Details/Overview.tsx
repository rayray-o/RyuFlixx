"use client";

import { Image, Chip, Button } from "@heroui/react";
import { getImageUrl, mutateTvShowTitle } from "@/utils/movies";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import ShareButton from "@/components/ui/button/ShareButton";
import { AppendToResponse } from "tmdb-ts/dist/types/options";
import { useDocumentTitle } from "@mantine/hooks";
import { siteConfig } from "@/config/site";
import { FaCirclePlay } from "react-icons/fa6";
import Genres from "@/components/ui/other/Genres";
import { TvShowDetails } from "tmdb-ts/dist/types/tv-shows";
import { Calendar, List, Season } from "@/utils/icons";
import Rating from "@/components/ui/other/Rating";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Trailer from "@/components/ui/overlay/Trailer";
import { SavedMovieDetails } from "@/types/movie";

export interface TvShowOverviewSectionProps {
  tv: AppendToResponse<TvShowDetails, "videos"[], "tvShow">;
  onViewEpisodesClick: () => void;
}

export const TvShowOverviewSection: React.FC<TvShowOverviewSectionProps> = ({
  tv,
  onViewEpisodesClick,
}) => {
  const firstReleaseYear = new Date(tv.first_air_date).getFullYear();
  const lastReleaseYear = new Date(tv.last_air_date).getFullYear();
  const releaseYears = `${firstReleaseYear} ${firstReleaseYear !== lastReleaseYear ? ` - ${lastReleaseYear}` : ""}`;

  const posterImage = getImageUrl(tv.poster_path);
  const title = mutateTvShowTitle(tv);
  const fullTitle = title;

  const bookmarkData: SavedMovieDetails = {
    type: "tv",
    adult: "adult" in tv ? (tv.adult as boolean) : false,
    backdrop_path: tv.backdrop_path,
    id: tv.id,
    poster_path: tv.poster_path,
    release_date: tv.first_air_date,
    title: fullTitle,
    vote_average: tv.vote_average,
    saved_date: new Date().toISOString(),
  };

  useDocumentTitle(`${fullTitle} | ${siteConfig.name}`);

  return (
    <section
      id="overview"
      className="relative z-3 flex flex-col gap-12 pt-[40vh] md:pt-[48vh] lg:pt-[54vh]"
    >
      <div className="px-4 md:px-0">
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-background/55 p-4 shadow-2xl backdrop-blur-xl md:p-6 lg:p-7">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/[0.045] via-transparent to-transparent" />

          <div className="relative md:grid md:grid-cols-[210px_1fr] md:gap-7 lg:grid-cols-[230px_1fr] lg:gap-9">
            <div className="hidden md:block">
              <Image
                isBlurred
                shadow="lg"
                alt={fullTitle}
                classNames={{
                  wrapper:
                    "aspect-2/3 w-full overflow-hidden rounded-2xl",
                }}
                className="h-full w-full object-cover object-center"
                src={posterImage}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-7">
              <div
                id="title"
                className="flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip
                    color="warning"
                    variant="faded"
                    size="sm"
                    classNames={{
                      content: "font-bold",
                    }}
                  >
                    TV
                  </Chip>

                  {("adult" in tv ? Boolean(tv.adult) : false) && (
                    <Chip
                      color="danger"
                      variant="faded"
                      size="sm"
                    >
                      18+
                    </Chip>
                  )}
                </div>

                <h1 className="max-w-4xl text-3xl font-black tracking-tight md:text-4xl lg:text-5xl">
                  {fullTitle}
                </h1>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-foreground-500">
                  <div className="flex items-center gap-1.5">
                    <Season />
                    <span>
                      {tv.number_of_seasons} Season
                      {tv.number_of_seasons > 1 ? "s" : ""}
                    </span>
                  </div>

                  <span aria-hidden="true">•</span>

                  <div className="flex items-center gap-1.5">
                    <List />
                    <span>
                      {tv.number_of_episodes} Episode
                      {tv.number_of_episodes > 1 ? "s" : ""}
                    </span>
                  </div>

                  <span aria-hidden="true">•</span>

                  <div className="flex items-center gap-1.5">
                    <Calendar />
                    <span>{releaseYears}</span>
                  </div>

                  <span aria-hidden="true">•</span>

                  <Rating
                    rate={tv.vote_average}
                    count={tv.vote_count}
                  />
                </div>

                <Genres genres={tv.genres} type="tv" />
              </div>

              <div
                id="action"
                className="flex flex-wrap items-center gap-3"
              >
                <Button
                  color="warning"
                  variant="shadow"
                  size="lg"
                  className="font-bold"
                  onPress={onViewEpisodesClick}
                  startContent={
                    <FaCirclePlay size={21} />
                  }
                >
                  View Episodes
                </Button>

                <Trailer
                  color="warning"
                  videos={tv.videos.results}
                />

                <div className="flex items-center gap-2">
                  <ShareButton
                    id={tv.id}
                    title={title}
                    type="tv"
                  />

                  <BookmarkButton
                    data={bookmarkData}
                  />
                </div>
              </div>

              <div
                id="story"
                className="max-w-4xl"
              >
                <SectionTitle color="warning">
                  Story Line
                </SectionTitle>

                <p className="mt-2 text-sm leading-7 text-foreground-500 md:text-base md:leading-8">
                  {tv.overview ||
                    "No overview is available for this TV show."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TvShowOverviewSection;
