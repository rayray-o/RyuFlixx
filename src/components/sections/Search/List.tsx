
"use client";

import {
  getSearchResults,
  UnifiedSearchItem,
  UnifiedSearchPage,
} from "@/actions/search";
import TvShowHomeCard from "@/components/sections/TV/Cards/Poster";
import BackToTopButton from "@/components/ui/button/BackToTopButton";
import { isEmpty } from "@/utils/helpers";
import { getLoadingLabel } from "@/utils/movies";
import { Spinner } from "@heroui/react";
import { useInViewport } from "@mantine/hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Movie, TV } from "tmdb-ts/dist/types";
import MoviePosterCard from "../Movie/Cards/Poster";
import SearchFilter from "./Filter";

const SearchList = () => {
  const { ref, inViewport } = useInViewport();

  const [submittedSearchQuery, setSubmittedSearchQuery] =
    useState("");

  const triggered = !isEmpty(submittedSearchQuery.trim());

  const {
    data,
    isFetching,
    isPending,
    isError,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    enabled: triggered,
    queryKey: ["unified-search-list", submittedSearchQuery],
    queryFn: async ({ pageParam }): Promise<UnifiedSearchPage> => {
      const response = await getSearchResults(
        submittedSearchQuery,
        pageParam,
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.message || "Search request failed",
        );
      }

      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages
        ? lastPage.page + 1
        : undefined,
  });

  useEffect(() => {
    if (
      inViewport &&
      hasNextPage &&
      !isFetching &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [
    inViewport,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const resultPages = data?.pages ?? [];

  const firstPageResults =
    resultPages[0]?.results ?? [];

  const totalResults =
    resultPages[0]?.total_results ?? 0;

  const renderResult = (item: UnifiedSearchItem) => {
    if (item.media_type === "movie") {
      return (
        <MoviePosterCard
          key={`movie-${item.id}`}
          movie={item as unknown as Movie}
          variant="bordered"
        />
      );
    }

    return (
      <TvShowHomeCard
        key={`tv-${item.id}`}
        tv={item as unknown as TV}
        variant="bordered"
      />
    );
  };

  const renderSearchResults = () => {
    if (isError) {
      return (
        <div className="mt-40 text-center">
          <h5 className="text-xl font-semibold">
            Search couldn't be completed
          </h5>
          <p className="mt-2 text-sm text-default-500">
            Please try again in a moment.
          </p>
        </div>
      );
    }

    if (isEmpty(firstPageResults)) {
      return (
        <div className="mt-40 flex flex-col items-center gap-3 px-4 text-center">
          <h5 className="text-xl font-semibold">
            No results found
          </h5>
          <p className="max-w-md text-sm text-default-500">
            Try another spelling, a shorter title, or describe
            what you're looking for differently.
          </p>
        </div>
      );
    }

    const allResults = resultPages.flatMap(
      (page) => page.results,
    );

    return (
      <>
        <h5 className="text-center text-sm text-default-500 sm:text-base">
          Found{" "}
          <span className="font-semibold text-success">
            {totalResults.toLocaleString()}
          </span>{" "}
          results for{" "}
          <span className="font-semibold text-warning">
            "{submittedSearchQuery}"
          </span>
        </h5>

        <div className="movie-grid">
          {allResults.map(renderResult)}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <SearchFilter
        isLoading={isFetching}
        onSearchSubmit={(value) =>
          setSubmittedSearchQuery(value.trim())
        }
      />

      {triggered && (
        <>
          <div className="relative flex w-full flex-col items-center gap-8">
            {isPending ? (
              <Spinner
                size="lg"
                className="absolute-center mt-56"
                color="primary"
                variant="simple"
              />
            ) : (
              renderSearchResults()
            )}
          </div>

          <div
            ref={ref}
            className="flex h-24 w-full items-center justify-center"
          >
            {isFetchingNextPage && (
              <Spinner
                color="primary"
                size="lg"
                variant="wave"
                label={getLoadingLabel()}
              />
            )}

            {!isEmpty(firstPageResults) &&
              !hasNextPage &&
              !isPending && (
                <p className="text-center text-base text-muted-foreground">
                  You have reached the end of the list.
                </p>
              )}
          </div>
        </>
      )}

      <BackToTopButton />
    </div>
  );
};

export default SearchList;
