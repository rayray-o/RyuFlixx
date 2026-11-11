"use client";

import { getSearchSuggestions } from "@/actions/search";
import SearchInput from "@/components/ui/input/SearchInput";
import ContentTypeSelection from "@/components/ui/other/ContentTypeSelection";
import Highlight from "@/components/ui/other/Highlight";
import useBreakpoints from "@/hooks/useBreakpoints";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import { ContentType } from "@/types";
import { SEARCH_HISTORY_STORAGE_KEY } from "@/utils/constants";
import { cn, isEmpty } from "@/utils/helpers";
import { normalizeSearchText } from "@/utils/search";
import { ArrowUpLeft, Close, History, Movie, Search, TV } from "@/utils/icons";
import { useRouter } from "@bprogress/next/app";
import { Button, Listbox, ListboxItem } from "@heroui/react";
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

const SearchFilter: React.FC<SearchFilterProps> = ({
  isLoading,
  onSearchSubmit,
  ...props
}) => {
  const router = useRouter();
  const { mobile } = useBreakpoints();
  const { content } = useDiscoverFilters();

  const [triggered, setTriggered] = useState(false);

  const [searchQuery, setSearchQuery] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );

  const [debouncedSearchQuery] = useDebouncedValue(
    searchQuery,
    220,
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
    queryKey: [
      "search-suggestions",
      content,
      normalizedQuery,
    ],
    queryFn: async () =>
      getSearchSuggestions(
        debouncedSearchQuery,
        content as ContentType,
      ),
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
        const updated = [
          ...searchHistories,
          value,
        ].slice(-8);

        setSearchHistories(updated);
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

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full max-w-xl flex-col justify-center gap-5 text-center",
        {
          "absolute-center px-3 md:px-0": !triggered,
        },
      )}
      {...props}
    >
      <ContentTypeSelection className="justify-center" />

      <div className="relative flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2">
          <SearchInput
            autoFocus
            placeholder={`Search your favorite ${
              content === "movie" ? "movies" : "TV shows"
            }...`}
            isLoading={isLoading}
            value={searchQuery}
            onValueChange={(value) => {
              setSearchQuery(value);

              // Editing a submitted query must reopen
              // autocomplete and hide the previous results.
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
                initial={{
                  width: 0,
                  opacity: 0,
                }}
                animate={{
                  width: "auto",
                  opacity: 1,
                }}
                exit={{
                  width: 0,
                  opacity: 0,
                }}
                transition={{
                  duration: 0.2,
                }}
              >
                <Button
                  isLoading={isLoading}
                  isIconOnly={mobile}
                  type="submit"
                  radius="full"
                  variant="flat"
                  color={
                    content === "movie"
                      ? "primary"
                      : "warning"
                  }
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
              initial={{
                height: 0,
                opacity: 0,
              }}
              animate={{
                height: "auto",
                opacity: 1,
              }}
              exit={{
                height: 0,
                opacity: 0,
              }}
              transition={{
                duration: 0.2,
              }}
            >
              <Listbox
                variant="flat"
                aria-label="Search suggestions"
                className="absolute top-12 z-999 w-full rounded-medium bg-content1 text-start shadow-2xl md:top-13"
                classNames={{
                  list: "max-h-[16rem] overflow-y-auto",
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
                          className="text-start"
                          startContent={<History />}
                          endContent={
                            <Button
                              isIconOnly
                              variant="light"
                              size="sm"
                              className="size-6"
                              onPress={() =>
                                setSearchHistories(
                                  searchHistories.filter(
                                    (current) =>
                                      current !== history,
                                  ),
                                )
                              }
                            >
                              <Close size={24} />
                            </Button>
                          }
                          onPress={() =>
                            setSearchQuery(history)
                          }
                        >
                          {history}
                        </ListboxItem>
                      ))}

                  {showSuggestions &&
                    suggestions.map(
                      ({ id, title, type }) => (
                        <ListboxItem
                          key={`${type}-${id}`}
                          className="text-start"
                          startContent={
                            type === "movie" ? (
                              <Movie className="text-primary" />
                            ) : (
                              <TV className="text-warning" />
                            )
                          }
                          endContent={
                            <Button
                              isIconOnly
                              variant="light"
                              size="sm"
                              className="size-6"
                              onPress={() =>
                                setSearchQuery(title)
                              }
                            >
                              <ArrowUpLeft size={20} />
                            </Button>
                          }
                          onPress={() =>
                            handleSuggestion(type, id)
                          }
                        >
                          <Highlight
                            markType="bold"
                            highlight={debouncedSearchQuery}
                          >
                            {title}
                          </Highlight>
                        </ListboxItem>
                      ),
                    )}
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
