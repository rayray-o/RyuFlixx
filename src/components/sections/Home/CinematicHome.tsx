"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInViewport } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import type { Movie, TV } from "tmdb-ts/dist/types";

import { siteConfig } from "@/config/site";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import {
  getTvContinuation,
  getWatchHistory,
  LocalWatchHistory,
} from "@/utils/localStorage";
import { mutateMovieTitle, mutateTvShowTitle } from "@/utils/movies";
import { cn } from "@/utils/helpers";
import ResumeCard from "./Cards/Resume";

type Media = Movie | TV;
type Content = "movie" | "tv";

type HeroCandidate = {
  id: number;
  content: Content;
  title: string;
  overview: string;
  backdrop: string;
  poster: string;
  rating: number;
  year: string;
  history?: LocalWatchHistory;
};

const tmdbBackdrop = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/original${path}` : "";

const tmdbPoster = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/w780${path}` : "";

function mediaTitle(media: Media): string {
  return "title" in media
    ? mutateMovieTitle(media as Movie)
    : mutateTvShowTitle(media as TV);
}

function mediaYear(media: Media): string {
  const date = "release_date" in media ? media.release_date : media.first_air_date;
  return date ? date.slice(0, 4) : "";
}

function mediaContent(media: Media): Content {
  return "title" in media ? "movie" : "tv";
}

function mediaLink(media: Media): string {
  return `/${mediaContent(media)}/${media.id}`;
}

function mediaLinkFromCandidate(candidate: HeroCandidate): string {
  return `/${candidate.content}/${candidate.id}`;
}

function candidateFromMedia(media: Media): HeroCandidate {
  return {
    id: media.id,
    content: mediaContent(media),
    title: mediaTitle(media),
    overview: media.overview || "",
    backdrop: tmdbBackdrop(media.backdrop_path) || tmdbPoster(media.poster_path),
    poster: tmdbPoster(media.poster_path),
    rating: media.vote_average || 0,
    year: mediaYear(media),
  };
}

function candidateFromHistory(item: LocalWatchHistory): HeroCandidate {
  return {
    id: item.media_id,
    content: item.type,
    title: item.title,
    overview: "",
    backdrop: tmdbBackdrop(item.backdrop_path) || tmdbPoster(item.poster_path),
    poster: tmdbPoster(item.poster_path),
    rating: item.vote_average || 0,
    year: item.release_date ? item.release_date.slice(0, 4) : "",
    history: item,
  };
}

function heroKey(candidate: HeroCandidate | null | undefined) {
  return candidate ? `${candidate.content}-${candidate.id}` : "";
}

function buildContinueHistory(history: LocalWatchHistory[], content: Content) {
  if (content === "movie") {
    return history.filter((item) => item.type === "movie" && !item.completed);
  }

  const latestByShow = new Map<number, LocalWatchHistory>();

  for (const item of history) {
    if (item.type !== "tv") continue;
    if (!latestByShow.has(item.media_id)) latestByShow.set(item.media_id, item);
  }

  const result: LocalWatchHistory[] = [];

  for (const media of latestByShow.values()) {
    const continuation = getTvContinuation(media.media_id);

    if (media.completed && continuation) {
      result.push(media);
    } else if (!media.completed) {
      result.push(media);
    }
  }

  return result;
}

function moveRailFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

  const current = event.currentTarget;
  const rail = current.closest("[data-rail]");
  if (!rail) return;

  const items = Array.from(rail.querySelectorAll<HTMLElement>("[data-rail-item]"));
  const index = items.indexOf(current);
  if (index < 0) return;

  const direction = event.key === "ArrowRight" ? 1 : -1;
  const next = items[index + direction];
  if (!next) return;

  event.preventDefault();
  next.focus();
  next.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function MediaTile({
  media,
  onFocus,
}: {
  media: Media;
  onFocus: () => void;
}) {
  const title = mediaTitle(media);
  const content = mediaContent(media);
  const poster = tmdbPoster(media.poster_path);

  return (
    <Link
      href={mediaLink(media)}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onKeyDown={moveRailFocus}
      data-rail-item
      className="group block w-[126px] shrink-0 outline-none sm:w-[150px] md:w-[170px] lg:w-[182px]"
      aria-label={title}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-white/[0.035] transition duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.025] group-focus-visible:-translate-y-1 group-focus-visible:scale-[1.025] group-focus-visible:ring-2 group-focus-visible:ring-white/80">
        <img
          src={poster || tmdbBackdrop(media.backdrop_path)}
          alt=""
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-70" />
        <div className="absolute inset-x-2 bottom-2 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="truncate text-[11px] font-semibold text-white">{title}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-white/50">
            {content === "movie" ? "Movie" : "Series"}
            {mediaYear(media) && ` · ${mediaYear(media)}`}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Rail({
  name,
  query,
  content,
  onFocus,
}: {
  name: string;
  query: () => Promise<{ results: Media[] }>;
  content: Content;
  onFocus: (candidate: HeroCandidate) => void;
}) {
  const { ref, inViewport } = useInViewport();
  const key = `${content}-${name}`;
  const { data, isPending } = useQuery({
    queryKey: ["cinematic-home-final", key],
    queryFn: query,
    enabled: inViewport,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  return (
    <section ref={ref} className="relative py-5 md:py-7">
      <div className="mb-4 flex items-end justify-between gap-4 px-5 md:px-10 lg:px-14">
        <h2 className="text-[15px] font-semibold tracking-tight text-white md:text-lg">
          {name.replace(/ Movies| TV Shows/g, "")}
        </h2>
        <span className="hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-white/25 md:block">
          Browse
        </span>
      </div>

      <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14">
        <div data-rail className="flex gap-3 overflow-x-auto overscroll-x-contain pr-5 pb-3 scrollbar-none md:gap-4 md:pr-10 lg:pr-14">
          {isPending && !data
            ? Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] w-[126px] shrink-0 animate-pulse rounded-[3px] bg-white/[0.05] sm:w-[150px] md:w-[170px] lg:w-[182px]"
                />
              ))
            : data?.results?.map((media) => (
                <MediaTile
                  key={media.id}
                  media={media}
                  onFocus={() => onFocus(candidateFromMedia(media))}
                />
              ))}
        </div>
      </div>
    </section>
  );
}

export default function CinematicHome() {
  const { content, setContent } = useDiscoverFilters();
  const [history, setHistory] = useState<LocalWatchHistory[]>([]);
  const [selected, setSelected] = useState<HeroCandidate | null>(null);
  const [displayedBackdrop, setDisplayedBackdrop] = useState("");
  const [previousBackdrop, setPreviousBackdrop] = useState("");
  const [backdropCrossfading, setBackdropCrossfading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const autoTimer = useRef<number | null>(null);
  const changeToken = useRef(0);

  useEffect(() => {
    const refresh = () => setHistory(getWatchHistory());
    refresh();
    window.addEventListener("ryuflix-history-updated", refresh);
    window.addEventListener("ryuflix-tv-continuation-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("ryuflix-history-updated", refresh);
      window.removeEventListener("ryuflix-tv-continuation-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const currentHistory = useMemo(
    () => buildContinueHistory(history, content),
    [history, content],
  );

  const fallbackLists = content === "movie" ? siteConfig.queryLists.movies : siteConfig.queryLists.tvShows;

  const { data: fallbackData } = useQuery({
    queryKey: ["cinematic-home-final", "hero-fallback", content],
    queryFn: async () => {
      const indexes = [...new Set([0, 1, 2, fallbackLists.length - 1])].filter(
        (index) => index >= 0 && index < fallbackLists.length,
      );

      for (const index of indexes) {
        const result = (await fallbackLists[index].query()) as { results?: Media[] };
        if (result.results?.length) return result;
      }

      return { results: [] };
    },
    enabled: currentHistory.length === 0,
    staleTime: 1000 * 60 * 10,
  });

  const heroCandidates = useMemo(() => {
    if (currentHistory.length > 0) return currentHistory.map(candidateFromHistory);
    return (fallbackData?.results ?? []).slice(0, 8).map(candidateFromMedia);
  }, [currentHistory, fallbackData]);

  useEffect(() => {
    if (!heroCandidates.length) return;

    setSelected((current) => {
      if (current && heroCandidates.some((item) => heroKey(item) === heroKey(current))) {
        return current;
      }
      return heroCandidates[0];
    });
  }, [heroCandidates]);

  const requestBackdrop = (candidate: HeroCandidate) => {
    if (!candidate.backdrop || candidate.backdrop === displayedBackdrop) return;

    const token = ++changeToken.current;
    const image = new Image();

    image.onload = () => {
      if (token !== changeToken.current) return;

      setPreviousBackdrop(displayedBackdrop);
      setDisplayedBackdrop(candidate.backdrop);
      setBackdropCrossfading(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (token === changeToken.current) setBackdropCrossfading(false);
        });
      });
    };

    image.src = candidate.backdrop;
  };

  const selectCandidate = (candidate: HeroCandidate, delayed = false) => {
    if (isMobile) return;

    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);

    const apply = () => setSelected(candidate);

    if (delayed) {
      hoverTimer.current = window.setTimeout(apply, 90);
    } else {
      apply();
    }
  };

  useEffect(() => {
    if (!isMobile || heroCandidates.length < 2) return;

    const start = () => {
      if (document.hidden) return;

      setSelected((current) => {
        if (!current) return heroCandidates[0];
        const index = heroCandidates.findIndex((item) => heroKey(item) === heroKey(current));
        return heroCandidates[(index + 1) % heroCandidates.length];
      });
    };

    autoTimer.current = window.setInterval(start, 9000);

    const visibility = () => {
      if (document.hidden && autoTimer.current !== null) {
        window.clearInterval(autoTimer.current);
        autoTimer.current = null;
      } else if (!document.hidden && autoTimer.current === null) {
        autoTimer.current = window.setInterval(start, 9000);
      }
    };

    document.addEventListener("visibilitychange", visibility);

    return () => {
      if (autoTimer.current !== null) window.clearInterval(autoTimer.current);
      autoTimer.current = null;
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [isMobile, heroCandidates]);

  useEffect(
    () => () => {
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      if (autoTimer.current !== null) window.clearInterval(autoTimer.current);
    },
    [],
  );

  const lists = content === "movie" ? siteConfig.queryLists.movies : siteConfig.queryLists.tvShows;
  const hero = selected;

  return (
    <div className="relative -mx-4 -mt-5 min-h-screen overflow-hidden bg-[#050505] md:-mx-6 md:-mt-8">
      <section className="relative min-h-[620px] overflow-hidden sm:min-h-[690px] md:min-h-[760px]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
          {previousBackdrop && (
            <img
              src={previousBackdrop}
              alt=""
              className={cn(
                "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]",
                backdropCrossfading ? "opacity-100" : "opacity-0",
              )}
            />
          )}

          {displayedBackdrop && (
            <img
              src={displayedBackdrop}
              alt=""
              className={cn(
                "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]",
                backdropCrossfading ? "opacity-0" : "opacity-100",
              )}
            />
          )}

          <div className="absolute inset-0 bg-black/18" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/20 to-black/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/5 to-black/30" />
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/55 to-transparent" />
        </div>

        <div className="relative z-10 flex min-h-[620px] flex-col justify-end pb-10 sm:min-h-[690px] md:min-h-[760px] md:pb-16">
          <div className="mb-8 flex items-center gap-5 px-5 md:mb-10 md:px-10 lg:px-14">
            <button
              type="button"
              onClick={() => setContent("movie")}
              className={cn(
                "relative py-2 text-[11px] font-bold uppercase tracking-[0.18em] outline-none transition-colors",
                content === "movie" ? "text-white" : "text-white/35 hover:text-white/70",
              )}
            >
              Movies
              {content === "movie" && <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-white" />}
            </button>
            <button
              type="button"
              onClick={() => setContent("tv")}
              className={cn(
                "relative py-2 text-[11px] font-bold uppercase tracking-[0.18em] outline-none transition-colors",
                content === "tv" ? "text-white" : "text-white/35 hover:text-white/70",
              )}
            >
              TV
              {content === "tv" && <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-white" />}
            </button>
          </div>

          <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14">
            <div data-rail className="flex gap-3 overflow-x-auto overscroll-x-contain pr-5 pb-4 scrollbar-none md:gap-4 md:pr-10 lg:pr-14">
              {heroCandidates.map((candidate) => {
                const active = heroKey(candidate) === heroKey(hero);
                return (
                  <Link
                    key={heroKey(candidate)}
                    href={mediaLinkFromCandidate(candidate)}
                    onMouseEnter={() => selectCandidate(candidate, true)}
                    onFocus={() => selectCandidate(candidate)}
                    onKeyDown={moveRailFocus}
                    data-rail-item
                    className={cn(
                      "group relative block w-[126px] shrink-0 outline-none sm:w-[150px] md:w-[170px] lg:w-[182px]",
                      active && "-translate-y-2",
                    )}
                    aria-label={candidate.title}
                  >
                    <div
                      className={cn(
                        "relative aspect-[4/5] overflow-hidden rounded-[3px] bg-black/40 shadow-2xl transition duration-500",
                        active
                          ? "scale-[1.045] ring-2 ring-white shadow-black/70"
                          : "opacity-80 group-hover:opacity-100 group-focus-visible:opacity-100",
                      )}
                    >
                      <img
                        src={candidate.poster || candidate.backdrop}
                        alt=""
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                        loading={active ? "eager" : "lazy"}
                      />
                      {active && <div className="absolute inset-x-0 bottom-0 h-1 bg-white" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      <div className="relative z-10 bg-[#050505] pb-20 pt-2">
        {currentHistory.length > 0 && (
          <section className="py-7">
            <div className="mb-4 flex items-end justify-between px-5 md:px-10 lg:px-14">
              <div>
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/25">
                  Pick up where you left off
                </p>
                <h2 className="text-[17px] font-semibold tracking-tight text-white md:text-xl">Continue Watching</h2>
              </div>
            </div>

            <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14">
              <div data-rail className="flex gap-3 overflow-x-auto overscroll-x-contain pr-5 pb-3 scrollbar-none md:gap-4 md:pr-10 lg:pr-14">
                {currentHistory.map((item) => (
                  <div key={item.key} className="w-[230px] shrink-0 sm:w-[270px] lg:w-[300px]">
                    <ResumeCard
                      media={item}
                      continuation={item.type === "tv" ? getTvContinuation(item.media_id) : null}
                      onFocus={() => selectCandidate(candidateFromHistory(item), true)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="pb-10 pt-2">
          {lists.map((list) => (
            <Rail
              key={list.name}
              name={list.name}
              query={list.query as () => Promise<{ results: Media[] }>}
              content={content}
              onFocus={(candidate) => selectCandidate(candidate, true)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
