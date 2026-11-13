
"use client";

import { getSearchSuggestions } from "@/actions/search";
import SearchInput from "@/components/ui/input/SearchInput";
import Highlight from "@/components/ui/other/Highlight";
import useBreakpoints from "@/hooks/useBreakpoints";
import { SEARCH_HISTORY_STORAGE_KEY } from "@/utils/constants";
import { cn, isEmpty } from "@/utils/helpers";
import { normalizeSearchText } from "@/utils/search";
import { ArrowUpLeft, Close, History, Search } from "@/utils/icons";
import { useRouter } from "@bprogress/next/app";
import { Button, Image, Listbox, ListboxItem } from "@heroui/react";
import { useDebouncedValue, useLocalStorage } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useState } from "react";

interface SearchFilterProps
  extends React.HTMLAttributes<HTMLFormElement> {
  isLoading?: boolean;
  onSearchSubmit?: (value: string) => void;
}

function formatRuntime(runtime: number | null): string {
  if (!runtime || runtime <= 0) return "";

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  isLoading,
  onSearchSubmit,
  ...props
}) => {
  const router = useRouter();
  const { mobile } = useBreakpoints();

  const [triggered, setTriggered] = useState(false);

  const [searchQuery, setSearchQuery] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );

  const [debouncedSearchQuery] = useDebouncedValue(
    searchQuery,
    300,
  );

  const [searchHistories, setSearchHistories] =
    useLocalStorage<string[]>({
      key: SEARCH_HISTORY_STORAGE_KEY,
      defaultValue: [],
    });

  const normalizedQuery = normalizeSearchText(
    debouncedSearchQuery,
  );

  const enableFetch =
    normalizedQuery.length >= 2 &&
    !isLoading &&
    !triggered;

  const { data, isFetching } = useQuery({
    enabled: enableFetch,
    queryKey: ["unified-search-suggestions", normalizedQuery],
    queryFn: async () =>
      getSearchSuggestions(debouncedSearchQuery, 8),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  const suggestions = data?.data ?? [];

  const showSuggestions =
    enableFetch &&
    !isFetching &&
    suggestions.length > 0;

  const showHistory =
    isEmpty(searchQuery.trim()) &&
    !isLoading &&
    !triggered &&
    !isEmpty(searchHistories);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      const value = searchQuery.trim();
      if (!value) return;

      setTriggered(true);
      onSearchSubmit?.(value);

      if (!searchHistories.includes(value)) {
        setSearchHistories(
          [...searchHistories, value].slice(-8),
        );
      }
    },
    [
      searchQuery,
      searchHistories,
      setSearchHistories,
      onSearchSubmit,
    ],
  );

  const handleClear = useCallback(() => {
    setSearchQuery("");
    setTriggered(false);
    onSearchSubmit?.("");
  }, [setSearchQuery, onSearchSubmit]);

  const handleSuggestion = useCallback(
    (type: "movie" | "tv", id: number) => {
      router.push(`/${type}/${id}`);
    },
    [router],
  );

  const chooseHistory = useCallback(
    (history: string) => {
      setSearchQuery(history);
      setTriggered(false);
      onSearchSubmit?.("");
    },
    [setSearchQuery, onSearchSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full max-w-2xl flex-col justify-center gap-4 text-center",
        {
          "absolute-center px-3 md:px-0": !triggered,
        },
      )}
      {...props}
    >
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2">
          <SearchInput
            autoFocus
            placeholder="Search movies, TV shows, people, genres..."
            isLoading={isLoading}
            value={searchQuery}
            onValueChange={(value) => {
              setSearchQuery(value);
              setTriggered(false);
              onSearchSubmit?.("");
            }}
            onClear={
              !isEmpty(searchQuery)
                ? handleClear
                : undefined
            }
          />

          <AnimatePresence>
            {!isEmpty(searchQuery.trim()) && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  isLoading={isLoading}
                  isIconOnly={mobile}
                  type="submit"
                  radius="full"
                  variant="flat"
                  color="primary"
                >
                  {mobile ? <Search /> : "Search"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(showSuggestions || showHistory) && (
          <AnimatePresence>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Listbox
                variant="flat"
                aria-label="Unified search suggestions"
                className="absolute top-12 z-999 w-full rounded-2xl bg-content1 p-2 text-start shadow-2xl md:top-13"
                classNames={{
                  list: "max-h-[25rem] overflow-y-auto gap-1",
                }}
              >
                <>
                  {showHistory &&
                    searchHistories
                      .slice()
                      .reverse()
                      .map((history, index) => (
                        <ListboxItem
                          key={`history-${history}-${index}`}
                          className="py-2"
                          startContent={<History />}
                          endContent={
                            <Button
                              isIconOnly
                              variant="light"
                              size="sm"
                              className="size-7"
                              onPress={() =>
                                setSearchHistories(
                                  searchHistories.filter(
                                    (current) =>
                                      current !== history,
                                  ),
                                )
                              }
                            >
                              <Close size={20} />
                            </Button>
                          }
                          onPress={() => chooseHistory(history)}
                        >
                          {history}
                        </ListboxItem>
                      ))}

                  {showSuggestions &&
                    suggestions.map((item) => {
                      const poster = item.poster_path
                        ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
                        : null;

                      const runtime = formatRuntime(item.runtime);

                      return (
                        <ListboxItem
                          key={`${item.type}-${item.id}`}
                          textValue={item.title}
                          className="min-h-[76px] py-2"
                          onPress={() =>
                            handleSuggestion(item.type, item.id)
                          }
                          startContent={
                            <div className="relative h-[62px] w-[44px] shrink-0 overflow-hidden rounded-md bg-default-200">
                              {poster ? (
                                <Image
                                  removeWrapper
                                  src={poster}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[9px] text-default-500">
                                  NO ART
                                </div>
                              )}
                            </div>
                          }
                          endContent={
                            <Button
                              isIconOnly
                              variant="light"
                              size="sm"
                              className="size-7 shrink-0"
                              onPress={() =>
                                setSearchQuery(item.title)
                              }
                              aria-label={`Use ${item.title} as search`}
                            >
                              <ArrowUpLeft size={20} />
                            </Button>
                          }
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold">
                                <Highlight
                                  markType="bold"
                                  highlight={debouncedSearchQuery}
                                >
                                  {item.title}
                                </Highlight>
                              </span>
                              <span className="shrink-0 rounded bg-default-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-default-600">
                                {item.type === "movie" ? "Movie" : "TV"}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-default-500">
                              {item.year && <span>{item.year}</span>}
                              {item.rating > 0 && (
                                <span>
                                  ★ {item.rating.toFixed(1)}
                                </span>
                              )}
                              {runtime && <span>{runtime}</span>}
                            </div>
                          </div>
                        </ListboxItem>
                      );
                    })}
                </>
              </Listbox>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </form>
  );
};

export default SearchFilter;
