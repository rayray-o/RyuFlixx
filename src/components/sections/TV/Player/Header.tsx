import { cn } from "@/utils/helpers";
import { ArrowLeft, List, Next, Prev, Server } from "@/utils/icons";
import ActionButton from "./ActionButton";
import { TvShowPlayerProps } from "./Player";

interface TvShowPlayerHeaderProps
  extends Omit<TvShowPlayerProps, "episodes" | "tv" | "startAt"> {
  hidden?: boolean;
  selectedSource: number;
  onOpenSource: () => void;
  onOpenEpisode: () => void;
}

const TvShowPlayerHeader: React.FC<TvShowPlayerHeaderProps> = ({
  id,
  seriesName,
  seasonName,
  episode,
  hidden,
  selectedSource,
  nextEpisodeNumber,
  nextEpisodeSeason,
  prevEpisodeNumber,
  prevEpisodeSeason,
  onOpenSource,
  onOpenEpisode,
}) => {
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-40 flex h-28 w-full items-center justify-between px-4 transition-all duration-300 md:px-8",
        hidden
          ? "pointer-events-none opacity-0"
          : "pointer-events-auto opacity-100",
      )}
    >
      {/* Left side */}
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <ActionButton label="Back" href={`/tv/${id}`}>
          <ArrowLeft size={42} />
        </ActionButton>

        <div className="hidden min-w-0 flex-col md:flex">
          <span className="truncate text-lg font-bold">
            {seriesName}
          </span>

          <span className="truncate text-sm opacity-70">
            {seasonName} — {episode.name}
          </span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 md:gap-2">
        <ActionButton
          disabled={!prevEpisodeNumber || !prevEpisodeSeason}
          label="Previous Episode"
          tooltip="Previous Episode"
          href={
            prevEpisodeNumber && prevEpisodeSeason
              ? `/tv/${id}/${prevEpisodeSeason}/${prevEpisodeNumber}/player?src=${selectedSource}`
              : undefined
          }
        >
          <Prev size={42} />
        </ActionButton>

        <ActionButton
          disabled={!nextEpisodeNumber || !nextEpisodeSeason}
          label="Next Episode"
          tooltip="Next Episode"
          href={
            nextEpisodeNumber && nextEpisodeSeason
              ? `/tv/${id}/${nextEpisodeSeason}/${nextEpisodeNumber}/player?src=${selectedSource}`
              : undefined
          }
        >
          <Next size={42} />
        </ActionButton>

        <ActionButton
          label="Episodes"
          tooltip="Episodes"
          onClick={onOpenEpisode}
        >
          <List size={42} />
        </ActionButton>

        <ActionButton
          label="Servers"
          tooltip="Servers"
          onClick={onOpenSource}
        >
          <Server size={42} />
        </ActionButton>
      </div>
    </div>
  );
};

export default TvShowPlayerHeader;
