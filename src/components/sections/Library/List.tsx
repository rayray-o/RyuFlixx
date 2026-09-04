"use client";

import BackToTopButton from "@/components/ui/button/BackToTopButton";
import ContentTypeSelection from "@/components/ui/other/ContentTypeSelection";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import {
  clearLocalWatchlist,
  getLocalWatchlist,
  LocalWatchlistItem,
} from "@/utils/localStorage";
import { isEmpty } from "@/utils/helpers";
import { Trash } from "@/utils/icons";
import {
  addToast,
  Button,
  Select,
  SelectItem,
} from "@heroui/react";
import {
  useDisclosure,
} from "@mantine/hooks";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import MoviePosterCard from "../Movie/Cards/Poster";
import TvShowPosterCard from "../TV/Cards/Poster";
import ConfirmationModal from "@/components/ui/overlay/ConfirmationModal";

type SortOption =
  | "title"
  | "release_date"
  | "vote_average"
  | "created_at";

const SORT_OPTIONS: {
  key: SortOption;
  label: string;
}[] = [
  {
    key: "title",
    label: "Title",
  },
  {
    key: "release_date",
    label: "Release Date",
  },
  {
    key: "vote_average",
    label: "Rating",
  },
  {
    key: "created_at",
    label: "Date Added",
  },
];

const LibraryList =
  () => {
    const {
      content,
    } = useDiscoverFilters();

    const [
      watchlist,
      setWatchlist,
    ] = useState<
      LocalWatchlistItem[]
    >([]);

    const [
      sortOption,
      setSortOption,
    ] =
      useState<SortOption>(
        "created_at",
      );

    const [
      opened,
      {
        open,
        close,
      },
    ] =
      useDisclosure(false);

    useEffect(() => {
      const refresh = () => {
        setWatchlist(
          getLocalWatchlist(),
        );
      };

      refresh();

      window.addEventListener(
        "ryuflix-watchlist-updated",
        refresh,
      );

      window.addEventListener(
        "storage",
        refresh,
      );

      return () => {
        window.removeEventListener(
          "ryuflix-watchlist-updated",
          refresh,
        );

        window.removeEventListener(
          "storage",
          refresh,
        );
      };
    }, []);

    const filteredWatchlist =
      useMemo(
        () =>
          watchlist.filter(
            (item) =>
              item.type ===
              content,
          ),
        [
          watchlist,
          content,
        ],
      );

    const sortedWatchlist =
      useMemo(() => {
        return [
          ...filteredWatchlist,
        ].sort((a, b) => {
          switch (
            sortOption
          ) {
            case "vote_average":
              return (
                b.vote_average -
                a.vote_average
              );

            case "release_date":
              return (
                new Date(
                  b.release_date,
                ).getTime() -
                new Date(
                  a.release_date,
                ).getTime()
              );

            case "created_at":
              return (
                new Date(
                  b.saved_date,
                ).getTime() -
                new Date(
                  a.saved_date,
                ).getTime()
              );

            case "title":
            default:
              return a.title.localeCompare(
                b.title,
              );
          }
        });
      }, [
        filteredWatchlist,
        sortOption,
      ]);

    const hasItems =
      !isEmpty(
        sortedWatchlist,
      );

    const confirmClear =
      () => {
        clearLocalWatchlist(
          content,
        );

        const count =
          sortedWatchlist.length;

        addToast({
          title: `Cleared ${count} ${
            content === "movie"
              ? "movies"
              : "TV shows"
          } from your watchlist!`,
          color: "success",
          icon: <Trash />,
        });

        close();
      };

    return (
      <>
        <div className="relative flex flex-col items-center justify-center gap-10">
          <div className="flex w-full flex-col items-center justify-center gap-2">
            <ContentTypeSelection
              className="justify-center"
            />

            <Select
              label="Sort by"
              size="sm"
              placeholder="Select sort"
              className="max-w-xs p-4"
              selectedKeys={[
                sortOption,
              ]}
              onChange={({
                target,
              }) =>
                setSortOption(
                  target.value as SortOption,
                )
              }
            >
              {SORT_OPTIONS.map(
                ({
                  key,
                  label,
                }) => (
                  <SelectItem
                    key={key}
                  >
                    {label}
                  </SelectItem>
                ),
              )}
            </Select>

            {hasItems && (
              <Button
                startContent={
                  <Trash />
                }
                color="danger"
                variant="shadow"
                onPress={open}
              >
                Clear{" "}
                {content ===
                "movie"
                  ? "Movies"
                  : "TV Shows"}{" "}
                from Watchlist
              </Button>
            )}
          </div>

          {hasItems ? (
            <div className="movie-grid">
              {sortedWatchlist.map(
                (data) => {
                  if (
                    data.type ===
                    "tv"
                  ) {
                    return (
                      <TvShowPosterCard
                        key={`tv-${data.id}`}
                        variant="bordered"
                        // @ts-expect-error: compatible local watchlist shape
                        tv={{
                          adult:
                            data.adult,
                          backdrop_path:
                            data.backdrop_path,
                          first_air_date:
                            data.release_date,
                          id: data.id,
                          name: data.title,
                          poster_path:
                            data.poster_path ||
                            "",
                          vote_average:
                            data.vote_average,
                        }}
                      />
                    );
                  }

                  return (
                    <MoviePosterCard
                      key={`movie-${data.id}`}
                      variant="bordered"
                      // @ts-expect-error: compatible local watchlist shape
                      movie={{
                        adult:
                          data.adult,
                        backdrop_path:
                          data.backdrop_path,
                        id: data.id,
                        poster_path:
                          data.poster_path ||
                          "",
                        release_date:
                          data.release_date,
                        title: data.title,
                        vote_average:
                          data.vote_average,
                      }}
                    />
                  );
                },
              )}
            </div>
          ) : (
            <div className="flex h-[30vh] items-center justify-center">
              <p className="text-default-500">
                No{" "}
                {content ===
                "movie"
                  ? "movies"
                  : "TV shows"}{" "}
                in your watchlist yet.
              </p>
            </div>
          )}
        </div>

        <BackToTopButton />

        <ConfirmationModal
          title={`Clear ${
            content === "movie"
              ? "Movies"
              : "TV Shows"
          }?`}
          isOpen={opened}
          onClose={close}
          onConfirm={
            confirmClear
          }
          confirmLabel="Clear All"
        >
          <p>
            Are you sure you
            want to remove all{" "}
            {content ===
            "movie"
              ? "movies"
              : "TV shows"}{" "}
            from your
            watchlist?
          </p>

          <p className="text-default-500 text-sm">
            {
              sortedWatchlist.length
            }{" "}
            {sortedWatchlist.length ===
            1
              ? "item"
              : "items"}{" "}
            will be removed.
          </p>
        </ConfirmationModal>
      </>
    );
  };

export default LibraryList;
