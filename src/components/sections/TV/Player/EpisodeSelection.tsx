"use client";

import VaulDrawer from "@/components/ui/overlay/VaulDrawer";
import { HandlerType } from "@/types/component";
import { Episode } from "tmdb-ts/dist/types/tv-episode";
import { EpisodeListCard } from "../Details/Episodes";
import { tmdb } from "@/api/tmdb";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Spinner,
} from "@heroui/react";
import { useState } from "react";
import { getLoadingLabel } from "@/utils/movies";
import { cn } from "@/utils/helpers";

interface TvShowPlayerEpisodeSelectionProps
  extends HandlerType {
  id: number;
  episodes: Episode[];
  currentSeason: number;
  totalSeasons: number;
}

const TvShowPlayerEpisodeSelection: React.FC<
  TvShowPlayerEpisodeSelectionProps
> = ({
  opened,
  onClose,
  id,
  episodes,
  currentSeason,
  totalSeasons,
}) => {
  const [selectedSeason, setSelectedSeason] =
    useState(currentSeason);

  const {
    data: seasonData,
    isPending,
  } = useQuery({
    queryFn: () =>
      selectedSeason === currentSeason
        ? Promise.resolve({
            episodes,
          })
        : tmdb.tvShows.season(
            id,
            selectedSeason,
          ),
    queryKey: [
      "tv-player-season-episodes",
      id,
      selectedSeason,
      currentSeason,
    ],
    enabled: opened,
  });

  const selectedEpisodes =
    seasonData?.episodes ?? [];

  return (
    <VaulDrawer
      open={opened}
      onClose={onClose}
      backdrop="blur"
      title="Select Episode"
      direction="right"
      hiddenHandler
      withCloseButton
    >
      <div className="flex h-full flex-col">
        {/* Season selector */}
        <div className="sticky top-0 z-30 border-b border-foreground-200 bg-background/95 p-3 backdrop-blur-md">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {Array.from(
              { length: totalSeasons },
              (_, index) => index + 1,
            ).map((season) => (
              <Button
                key={season}
                size="sm"
                variant={
                  selectedSeason === season
                    ? "solid"
                    : "flat"
                }
                color={
                  selectedSeason === season
                    ? "warning"
                    : "default"
                }
                className={cn(
                  "shrink-0",
                  selectedSeason === season &&
                    "font-bold",
                )}
                onPress={() =>
                  setSelectedSeason(season)
                }
              >
                Season {season}
              </Button>
            ))}
          </div>
        </div>

        {/* Episodes */}
        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <div className="flex h-full items-center justify-center">
              <Spinner
                variant="wave"
                size="lg"
                label={getLoadingLabel()}
                color="warning"
              />
            </div>
          ) : selectedEpisodes.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-center">
                No episodes found.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 p-2 sm:gap-4 sm:p-4">
              {selectedEpisodes.map(
                (episode, index) => (
                  <EpisodeListCard
                    id={id}
                    key={episode.id}
                    episode={episode}
                    order={index + 1}
                    withAnimation={false}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </VaulDrawer>
  );
};

export default TvShowPlayerEpisodeSelection;
