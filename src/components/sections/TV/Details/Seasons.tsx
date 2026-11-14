
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
  CardHeader,
  Input,
  ScrollShadow,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Tooltip,
} from "@heroui/react";

import { Season } from "tmdb-ts";
import { Grid, List, Search, SortAlpha } from "@/utils/icons";
import IconButton from "@/components/ui/button/IconButton";
import SectionTitle from "@/components/ui/other/SectionTitle";
import TvShowEpisodesSelection from "./Episodes";

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

    return (
      <section
        ref={ref}
        id="seasons-episodes"
        className="relative z-3 flex flex-col gap-4"
      >
        <SectionTitle color="warning">
          Season & Episode
        </SectionTitle>

        <Card
          shadow="none"
          className="overflow-hidden rounded-3xl border border-foreground-200/70 bg-background/80 shadow-xl backdrop-blur-xl"
        >
          <CardHeader className="flex flex-col items-stretch gap-4 p-4 sm:p-5">
            {/* Season and search */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.2fr)]">
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
                    "min-h-14 border-2 border-foreground-200 bg-foreground-100/70 shadow-none transition-colors data-[hover=true]:border-warning/60",
                  value: "font-semibold",
                  popoverContent:
                    "border border-foreground-200 bg-background/95 backdrop-blur-xl",
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
                placeholder="Search episodes..."
                value={search}
                onValueChange={setSearch}
                startContent={
                  <Search className="shrink-0 text-foreground-500" />
                }
                size="lg"
                radius="lg"
                variant="bordered"
                classNames={{
                  inputWrapper:
                    "min-h-14 border-2 border-foreground-200 bg-foreground-100/70 shadow-none transition-colors data-[hover=true]:border-warning/60 group-data-[focus=true]:border-warning",
                  input: "text-base",
                }}
              />
            </div>

            {/* View and sort controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs
                aria-label="Episode layout"
                selectedKey={layout}
                onSelectionChange={(key) =>
                  setLayout(key as "list" | "grid")
                }
                color="warning"
                variant="solid"
                size="lg"
                classNames={{
                  base: "w-fit",
                  tabList:
                    "gap-1 rounded-xl border border-foreground-200 bg-foreground-100/70 p-1",
                  cursor: "rounded-lg shadow-sm",
                  tab: "h-10 min-w-12 px-4",
                  tabContent:
                    "text-foreground-500 group-data-[selected=true]:text-black",
                }}
              >
                <Tab
                  key="list"
                  title={
                    <span className="flex items-center gap-2">
                      <List size={18} />
                      <span className="hidden sm:inline">List</span>
                    </span>
                  }
                />

                <Tab
                  key="grid"
                  title={
                    <span className="flex items-center gap-2">
                      <Grid size={18} />
                      <span className="hidden sm:inline">Grid</span>
                    </span>
                  }
                />
              </Tabs>

              <Tooltip
                content={
                  sortedByName
                    ? "Restore episode order"
                    : "Sort episodes alphabetically"
                }
              >
                <div>
                  <IconButton
                    tooltip={
                      sortedByName
                        ? "Restore episode order"
                        : "Sort by name"
                    }
                    className="h-11 w-11 rounded-xl border border-foreground-200 bg-foreground-100/70 p-2"
                    icon={<SortAlpha />}
                    onPress={() => setSortedByName((value) => !value)}
                    color={sortedByName ? "warning" : undefined}
                    variant={sortedByName ? "shadow" : "flat"}
                  />
                </div>
              </Tooltip>
            </div>

            {selectedSeason && (
              <div className="flex items-center justify-between border-t border-foreground-200/60 pt-3">
                <p className="text-sm font-semibold text-foreground-500">
                  {selectedSeason.name}
                </p>

                <p className="text-xs text-foreground-400">
                  {deferredSearch
                    ? "Filtered episodes"
                    : "Choose an episode to watch"}
                </p>
              </div>
            )}
          </CardHeader>

          <CardBody className="px-3 pb-4 pt-0 sm:px-5">
            {!filteredSeasons.length ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-foreground-500">
                No seasons available.
              </div>
            ) : (
              <ScrollShadow
                className="h-[600px] max-h-[70vh] min-h-[300px] py-1 pr-1 sm:pr-2"
                size={30}
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
