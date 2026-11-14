
"use client";

import {
  forwardRef,
  memo,
  useDeferredValue,
  useMemo,
  useState,
} from "react";

import {
  Card,
  CardBody,
  Input,
  ScrollShadow,
  Select,
  SelectItem,
} from "@heroui/react";

import { Season } from "tmdb-ts";
import { Grid, List, Search, SortAlpha } from "@/utils/icons";
import SectionTitle from "@/components/ui/other/SectionTitle";
import TvShowEpisodesSelection from "./Episodes";
import { cn } from "@/utils/helpers";

interface Props {
  id: number;
  seasons: Season[];
}

const TvShowsSeasonsSelection = forwardRef<HTMLElement, Props>(
  ({ id, seasons }, ref) => {
    const filteredSeasons = useMemo(
      () => seasons.filter((season) => season.season_number > 0),
      [seasons],
    );

    const [seasonNumber, setSeasonNumber] = useState(
      () => filteredSeasons[0]?.season_number.toString() ?? "",
    );

    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);

    const [layout, setLayout] = useState<"list" | "grid">("list");
    const [sortedByName, setSortedByName] = useState(false);

    const selectedSeason = useMemo(
      () =>
        filteredSeasons.find(
          (season) => season.season_number.toString() === seasonNumber,
        ),
      [filteredSeasons, seasonNumber],
    );

    const controlClass =
      "flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-medium text-white/65 transition-colors duration-150 hover:bg-white/[0.09]";

    return (
      <section
        ref={ref}
        id="seasons-episodes"
        className="relative z-3 flex flex-col gap-4"
      >
        <SectionTitle
          color="warning"
          size="h4"
          classNames={{
            title: "tracking-tight",
          }}
        >
          Season & Episode
        </SectionTitle>

        <Card
          shadow="none"
          className="overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#111113]/95 shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
        >
          <CardBody className="gap-5 p-3 sm:gap-6 sm:p-5">
            {/* Season and episode search */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(150px,0.7fr)_minmax(220px,1.3fr)]">
              <Select
                aria-label="Select season"
                placeholder="Select season"
                selectedKeys={seasonNumber ? [seasonNumber] : []}
                disallowEmptySelection
                isDisabled={!filteredSeasons.length}
                size="lg"
                radius="lg"
                variant="bordered"
                classNames={{
                  trigger:
                    "h-12 min-h-12 border border-white/10 bg-white/[0.045] shadow-none data-[hover=true]:bg-white/[0.075] data-[focus=true]:border-warning/60",
                  value: "text-sm font-semibold text-white",
                  popoverContent:
                    "border border-white/10 bg-[#19191c] text-white",
                }}
                onChange={(event) => {
                  setSearch("");
                  setSeasonNumber(event.target.value);
                }}
              >
                {filteredSeasons.map((season) => (
                  <SelectItem
                    key={season.season_number.toString()}
                    textValue={season.name}
                  >
                    {season.name}
                  </SelectItem>
                ))}
              </Select>

              <Input
                isClearable
                aria-label="Search episodes"
                placeholder="Find an episode..."
                value={search}
                onValueChange={setSearch}
                startContent={
                  <Search className="shrink-0 text-white/35" size={17} />
                }
                size="lg"
                radius="lg"
                variant="bordered"
                classNames={{
                  inputWrapper:
                    "h-12 min-h-12 border border-white/10 bg-white/[0.045] shadow-none data-[hover=true]:bg-white/[0.075] group-data-[focus=true]:border-warning/60",
                  input: "text-sm text-white placeholder:text-white/30",
                }}
              />
            </div>

            {/* Display controls */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.035] p-1">
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={layout === "list"}
                  onClick={() => setLayout("list")}
                  className={cn(
                    "flex h-10 min-w-11 items-center justify-center gap-2 rounded-lg px-3 transition-all duration-150",
                    layout === "list"
                      ? "bg-[#f5a623] text-black shadow-sm"
                      : "text-white/45 hover:text-white",
                  )}
                >
                  <List size={19} />
                  <span className="hidden text-xs font-semibold sm:inline">
                    List
                  </span>
                </button>

                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={layout === "grid"}
                  onClick={() => setLayout("grid")}
                  className={cn(
                    "flex h-10 min-w-11 items-center justify-center gap-2 rounded-lg px-3 transition-all duration-150",
                    layout === "grid"
                      ? "bg-[#f5a623] text-black shadow-sm"
                      : "text-white/45 hover:text-white",
                  )}
                >
                  <Grid size={19} />
                  <span className="hidden text-xs font-semibold sm:inline">
                    Grid
                  </span>
                </button>
              </div>

              <button
                type="button"
                aria-label={
                  sortedByName
                    ? "Restore episode order"
                    : "Sort episodes alphabetically"
                }
                aria-pressed={sortedByName}
                onClick={() => setSortedByName((value) => !value)}
                className={cn(
                  controlClass,
                  "h-11 w-11 px-0",
                  sortedByName &&
                    "border-warning/40 bg-warning/10 text-warning",
                )}
              >
                <SortAlpha size={19} />
              </button>
            </div>

            {/* Season information */}
            {selectedSeason && (
              <div className="flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white/90">
                    {selectedSeason.name}
                  </p>
                  <p className="mt-0.5 text-xs text-white/35">
                    {selectedSeason.episode_count ?? 0} episodes
                  </p>
                </div>

                <p className="shrink-0 text-xs text-white/35">
                  {deferredSearch
                    ? "Search results"
                    : "Select an episode"}
                </p>
              </div>
            )}

            {!filteredSeasons.length ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-white/45">
                No seasons available.
              </div>
            ) : (
              <ScrollShadow
                className="h-[600px] max-h-[70vh] min-h-[300px] pr-1"
                size={24}
              >
                <TvShowEpisodesSelection
                  id={id}
                  seasonNumber={Number(seasonNumber)}
                  filters={{
                    searchQuery: deferredSearch,
                    sortedByName,
                    layout,
                  }}
                />
              </ScrollShadow>
            )}
          </CardBody>
        </Card>
      </section>
    );
  },
);

TvShowsSeasonsSelection.displayName = "TvShowsSeasonsSelection";

export default memo(TvShowsSeasonsSelection);
