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
import { PlayOutline } from "@/utils/icons";
import { cn } from "@/utils/helpers";

// TMDB's image service supports an original-size backdrop. We intentionally
// use HTTPS here because RyuFlixx itself is served over HTTPS.
const tmdbBackdrop = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/original${path}` : "";

const tmdbPoster = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/w780${path}` : "";

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

function playLink(candidate: HeroCandidate): string {
  if (candidate.history?.type === "movie") {
    return `/movie/${candidate.id}/player`;
  }

  if (candidate.history?.type === "tv") {
    const continuation = getTvContinuation(candidate.id);
    const season = continuation?.season ?? candidate.history.season ?? 1;
    const episode = continuation?.episode ?? candidate.history.episode ?? 1;
    return `/tv/${candidate.id}/${season}/${episode}/player`;
  }

  return mediaLinkFromCandidate(candidate);
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
    backdrop:
      tmdbBackdrop(item.backdrop_path) ||
      tmdbPoster(item.poster_path),
    poster: tmdbPoster(item.poster_path),
    rating: item.vote_average || 0,
    year: item.release_date ? item.release_date.slice(0, 4) : "",
    history: item,
  };
}

function progress(item: LocalWatchHistory): number {
  if (item.completed) return 100;
  if (!item.duration || item.duration <= 0) return 0;
  return Math.max(0, Math.min(100, (item.last_position / item.duration) * 100));
}

function ResumeTile({
  item,
  onFocus,
}: {
  item: LocalWatchHistory;
  onFocus: () => void;
}) {
  const continuation = item.type === "tv" ? getTvContinuation(item.media_id) : null;
  const season = continuation?.season ?? item.season ?? 1;
  const episode = continuation?.episode ?? item.episode ?? 1;
  const href =
    item.type === "movie"
      ? `/movie/${item.media_id}/player`
      : `/tv/${item.media_id}/${season}/${episode}/player`;

  return (
    <Link
      href={href}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      className="group block w-[230px] shrink-0 sm:w-[270px] lg:w-[300px]"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-2xl transition duration-500 ease-out group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-black/60">
        <img
          src={tmdbBackdrop(item.backdrop_path) || tmdbPoster(item.poster_path)}
          alt=""
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress(item)}%` }}
          />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{item.title}</p>
            <p className="mt-0.5 text-[11px] text-white/50">
              {item.type === "tv" ? `S${season} · E${episode}` : "Resume"}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition group-hover:bg-white group-hover:text-black">
            <PlayOutline className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
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
      className="group block w-[185px] shrink-0 sm:w-[210px] lg:w-[225px]"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] transition duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.015] group-hover:border-white/20">
        <img
          src={tmdbBackdrop(media.backdrop_path) || poster}
          alt={title}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/15 to-transparent" />
        <div className="absolute inset-x-3 bottom-3">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
                {content === "movie" ? "Movie" : "Series"} {mediaYear(media) && `· ${mediaYear(media)}`}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-white/70">{media.vote_average?.toFixed(1) ?? "—"}</span>
          </div>
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
    queryKey: ["cinematic-home", key],
    queryFn: query,
    enabled: inViewport,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  return (
    <section ref={ref} className="relative py-5 md:py-7">
      <div className="mb-4 flex items-end justify-between gap-4 px-5 md:px-10 lg:px-14">
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.32em] text-white/30">RyuFlixx</p>
          <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">{name.replace(/ Movies| TV Shows/g, "")}</h2>
        </div>
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 md:block">See all</span>
      </div>

      <div className="overflow-hidden pl-5 md:pl-10 lg:pl-14">
        <div className="flex gap-3 overflow-x-auto overscroll-x-contain pr-5 pb-2 scrollbar-none md:gap-4 md:pr-10 lg:pr-14">
          {isPending && !data ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[185px] shrink-0 aspect-[16/10] animate-pulse rounded-xl bg-white/[0.05] sm:w-[210px] lg:w-[225px]" />
            ))
          ) : (
            data?.results?.map((media) => (
              <MediaTile
                key={media.id}
                media={media}
                onFocus={() => onFocus(candidateFromMedia(media))}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default function CinematicHome() {
  const { content, setContent } = useDiscoverFilters();
  const [history, setHistory] = useState<LocalWatchHistory[]>([]);
  const [selected, setSelected] = useState<HeroCandidate | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const heroTimer = useRef<number | null>(null);

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
    () =>
      history.filter(
        (item) =>
          item.type === content &&
          (!item.completed || (item.type === "tv" && !!getTvContinuation(item.media_id))),
      ),
    [history, content],
  );

  const fallbackQuery = siteConfig.queryLists[content === "movie" ? "movies" : "tvShows"][0]?.query;
  const { data: fallbackData } = useQuery({
    queryKey: ["cinematic-home", "hero-fallback", content],
    queryFn: async () =>
      (await (fallbackQuery ? fallbackQuery() : Promise.resolve({ results: [] }))) as { results: Media[] },
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
      if (current && heroCandidates.some((item) => item.id === current.id && item.content === current.content)) {
        return current;
      }
      return heroCandidates[0];
    });
    setHeroReady(true);
  }, [heroCandidates]);

  useEffect(() => {
    if (!isMobile || heroCandidates.length < 2) return;

    const advance = () => {
      setSelected((current) => {
        if (!current) return heroCandidates[0];
        const index = heroCandidates.findIndex(
          (item) => item.id === current.id && item.content === current.content,
        );
        return heroCandidates[(index + 1) % heroCandidates.length];
      });
    };

    heroTimer.current = window.setInterval(advance, 7500);
    return () => {
      if (heroTimer.current !== null) window.clearInterval(heroTimer.current);
      heroTimer.current = null;
    };
  }, [isMobile, heroCandidates]);

  const movies = siteConfig.queryLists.movies;
  const tvShows = siteConfig.queryLists.tvShows;
  const lists = content === "movie" ? movies : tvShows;

  const hero = selected;

  return (
    <div className="relative -mx-4 -mt-5 min-h-screen overflow-hidden bg-black md:-mx-6 md:-mt-8">
      <div className="pointer-events-none fixed inset-0 z-0">
        {hero?.backdrop && (
          <img
            key={hero.backdrop}
            src={hero.backdrop}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-center transition-all duration-[1400ms] ease-out",
              heroReady ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
            )}
          />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_32%,rgba(0,0,0,0.04),rgba(0,0,0,0.72)_72%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/20" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
      </div>

      <div className="relative z-10">
        <section className="relative flex min-h-[620px] items-end px-5 pb-16 pt-24 sm:min-h-[680px] md:min-h-[730px] md:px-10 md:pb-20 lg:px-14">
          <div className="max-w-2xl transition-all duration-700">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/55">
              <span>{hero?.content === "tv" ? "Series" : "Movie"}</span>
              {hero?.year && <span className="text-white/25">{hero.year}</span>}
              {hero && <span className="text-white/25">★ {hero.rating.toFixed(1)}</span>}
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {hero?.title ?? "Welcome to RyuFlixx"}
            </h1>

            <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
              {hero?.overview || "A cinematic home for everything you want to watch."}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {hero && (
                <Link
                  href={playLink(hero)}
                  className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black transition duration-300 hover:scale-[1.02] hover:bg-white/90"
                >
                  <PlayOutline className="h-4 w-4 transition-transform group-hover:scale-110" />
                  {hero.history ? "Continue" : "Explore"}
                </Link>
              )}
              {hero && (
                <Link
                  href={mediaLinkFromCandidate(hero)}
                  className="inline-flex h-11 items-center rounded-full border border-white/15 bg-black/25 px-6 text-sm font-semibold text-white/80 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  More info
                </Link>
              )}
            </div>

            {hero?.history && (
              <div className="mt-6 max-w-sm">
                <div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  <span>Continue watching</span>
                  <span>{Math.round(progress(hero.history))}%</span>
                </div>
                <div className="h-0.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full bg-white" style={{ width: `${progress(hero.history)}%` }} />
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="relative bg-gradient-to-b from-transparent via-black/95 to-black pt-1">
          {currentHistory.length > 0 && (
            <section className="py-6">
              <div className="mb-4 px-5 md:px-10 lg:px-14">
                <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/30">Pick up where you left off</p>
                <h2 className="mt-1 text-lg font-semibold text-white md:text-xl">Continue Watching</h2>
              </div>
              <div className="overflow-hidden pl-5">
                <div className="flex gap-3 overflow-x-auto pr-5 pb-2 scrollbar-none md:gap-4 md:pl-5 lg:pl-9">
                  {currentHistory.map((item) => (
                    <ResumeTile
                      key={item.key}
                      item={item}
                      onFocus={() => {
                        if (!isMobile) setSelected(candidateFromHistory(item));
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="flex justify-center px-5 py-7 md:px-10 lg:px-14">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.035] p-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setContent("movie")}
                className={cn(
                  "rounded-full px-5 py-2 text-xs font-semibold transition-all",
                  content === "movie" ? "bg-white text-black" : "text-white/45 hover:text-white",
                )}
              >
                Movies
              </button>
              <button
                type="button"
                onClick={() => setContent("tv")}
                className={cn(
                  "rounded-full px-5 py-2 text-xs font-semibold transition-all",
                  content === "tv" ? "bg-white text-black" : "text-white/45 hover:text-white",
                )}
              >
                TV
              </button>
            </div>
          </section>

          <div className="pb-20">
            {lists.map((list) => (
              <Rail
                key={list.name}
                name={list.name}
                query={list.query as () => Promise<{ results: Media[] }>}
                content={content}
                onFocus={(candidate) => {
                  if (!isMobile) setSelected(candidate);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
