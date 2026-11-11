
"use client";

import { tmdb } from "@/api/tmdb";
import { queryClient } from "@/app/providers";
import TvShowHomeCard from "@/components/sections/TV/Cards/Poster";
import BackToTopButton from "@/components/ui/button/BackToTopButton";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import { ContentType } from "@/types";
import { isEmpty } from "@/utils/helpers";
import { getLoadingLabel } from "@/utils/movies";
import { rankSearchResults } from "@/utils/search";
import { Spinner } from "@heroui/react";
import { useInViewport } from "@mantine/hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Movie, Search, TV } from "tmdb-ts/dist/types";
import MoviePosterCard from "../Movie/Cards/Poster";
import SearchFilter from "./Filter";

type FetchType = {
  page: number;
  type: ContentType;
  query: string;
};

const fetchData = async ({
  page,
  type = "movie",
  query,
}: FetchType): Promise<Search<Movie> | Search<TV>> => {
  if (type === "movie") {
    return tmdb.search.movies({ query, page });
  }

  return tmdb.search.tvShows({ query, page });
};

const SearchList = () => {
  const { content } = useDiscoverFilters();
  const { ref, inViewport } = useInViewport();

  const [submittedSearchQuery, setSubmittedSearchQuery] = useState("");

  const triggered = !isEmpty(submittedSearchQuery.trim());

  const {
    data,
    isFetching,
    isPending,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    enabled: triggered,
    queryKey: ["search-list", content, submittedSearchQuery],
    queryFn: ({ pageParam: page }) =>
      fetchData({
        page,
        type: content,
        query: submittedSearchQuery,
      }),
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

  useEffect(() => {
    queryClient.removeQueries({
      queryKey: ["search-list"],
    });
  }, [content]);

  const rankedPages = useMemo(() => {
    if (!data?.pages) return [];

    return data.pages.map((page) => {
      const ranked = rankSearchResults(
        page.results as (Movie | TV)[],
        submittedSearchQuery,
      );

      return {
        ...page,
        results: ranked.map((result) => result.item),
      };
    });
  }, [data?.pages, submittedSearchQuery]);

  const totalResults = data?.pages[0]?.total_results ?? 0;
  const firstPageResults = rankedPages[0]?.results ?? [];

  const renderSearchResults = () => {
    if (isEmpty(firstPageResults)) {
      return (
        <div className="mt-40 flex flex-col items-center gap-3 px-4 text-center">
          <h5 className="text-xl font-semibold">
            No {content === "movie" ? "movies" : "TV series"} found
          </h5>

          <p className="max-w-md text-sm text-default-500">
            Try another spelling, a shorter title, or a different search.
          </p>
        </div>
      );
    }

    return (
      <>
        <h5 className="text-center text-sm text-default-500 sm:text-base">
          Found{" "}
          <span className="font-semibold text-success">
            {totalResults.toLocaleString()}
          </span>{" "}
          {content === "movie" ? "movies" : "TV series"} for{" "}
          <span className="font-semibold text-warning">
            "{submittedSearchQuery}"
          </span>
        </h5>

        <div className="movie-grid">
          {content === "movie"
            ? rankedPages.map((page) =>
                (page.results as Movie[]).map((movie) => (
                  <MoviePosterCard
                    key={movie.id}
                    movie={movie}
                    variant="bordered"
                  />
                )),
              )
            : rankedPages.map((page) =>
                (page.results as TV[]).map((tv) => (
                  <TvShowHomeCard
                    key={tv.id}
                    tv={tv}
                    variant="bordered"
                  />
                )),
              )}
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
                color={content === "movie" ? "primary" : "warning"}
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
                color={content === "movie" ? "primary" : "warning"}
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
