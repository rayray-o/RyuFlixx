
"use client";

import {
  forwardRef,
  memo,
  useDeferredValue,
  useEffect,
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
    const [seasonSelectOpen, setSeasonSelectOpen] = useState(false);

    const selectedSeason = useMemo(
      () =>
        filteredSeasons.find(
          (season) => season.season_number.toString() === seasonNumber,
        ),
      [filteredSeasons, seasonNumber],
    );

    // Smooth pointer-edge auto-scroll for the season dropdown.
    useEffect(() => {
      if (!seasonSelectOpen) return;

      let pointerY: number | null = null;
      let scrollTarget: HTMLElement | null = null;
      let animationFrame = 0;
      let previousFrameTime = 0;

      const stopScrolling = () => {
        pointerY = null;
        scrollTarget = null;
        previousFrameTime = 0;

        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      };

      const animateScroll = (time: number) => {
        if (!scrollTarget || pointerY === null) {
          animationFrame = 0;
          previousFrameTime = 0;
          return;
        }

        const target = scrollTarget;
        const bounds = target.getBoundingClientRect();

        if (
          pointerY < bounds.top ||
          pointerY > bounds.bottom ||
          target.scrollHeight <= target.clientHeight + 1
        ) {
          animationFrame = 0;
          previousFrameTime = 0;
          return;
        }

        const edgeSize = Math.min(58, bounds.height * 0.22);
        let direction = 0;
        let intensity = 0;

        const distanceFromTop = pointerY - bounds.top;
        const distanceFromBottom = bounds.bottom - pointerY;

        if (distanceFromTop < edgeSize) {
          direction = -1;
          intensity = 1 - distanceFromTop / edgeSize;
        } else if (distanceFromBottom < edgeSize) {
          direction = 1;
          intensity = 1 - distanceFromBottom / edgeSize;
        }

        if (!direction) {
          animationFrame = 0;
          previousFrameTime = 0;
          return;
        }

        // Gradually accelerates toward the edge, without sudden jumps.
        const speed = 100 + Math.pow(intensity, 1.7) * 850;
        const elapsed = previousFrameTime
          ? Math.min(time - previousFrameTime, 32) / 1000
          : 0;

        previousFrameTime = time;

        const previousScrollTop = target.scrollTop;
        target.scrollTop += direction * speed * elapsed;

        // Stop at either end instead of continuously wasting frames.
        if (
          target.scrollTop === previousScrollTop &&
          (target.scrollTop <= 0 ||
            target.scrollTop >= target.scrollHeight - target.clientHeight)
        ) {
          animationFrame = 0;
          previousFrameTime = 0;
          return;
        }

        animationFrame = requestAnimationFrame(animateScroll);
      };

      const handlePointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;

        const listbox =
          document.querySelector<HTMLElement>('[role="listbox"]');

        if (!listbox) {
          stopScrolling();
          return;
        }

        const bounds = listbox.getBoundingClientRect();

        // Only activate while the pointer is actually over the dropdown.
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          stopScrolling();
          return;
        }

        pointerY = event.clientY;
        scrollTarget = listbox;

        if (!animationFrame) {
          animationFrame = requestAnimationFrame(animateScroll);
        }
      };

      document.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });

      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        stopScrolling();
      };
    }, [seasonSelectOpen]);

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
                isOpen={seasonSelectOpen}
                onOpenChange={setSeasonSelectOpen}
                size="lg"
                radius="lg"
                variant="bordered"
                listboxProps={{
                  className:
                    "max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                }}
                classNames={{
                  trigger:
                    "h-12 min-h-12 border border-white/10 bg-white/[0.045] shadow-none data-[hover=true]:bg-white/[0.075] data-[focus=true]:border-warning/60",
                  value: "text-sm font-semibold text-white",
                  popoverContent:
                    "max-h-[min(65vh,460px)] overflow-hidden border border-white/10 bg-[#19191c] text-white",
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
