"use client";

import { useEffect, useRef, useState } from "react";
import {
  IoSparkles,
  IoCloudUploadOutline,
  IoCheckmarkCircle,
  IoLockClosedOutline,
  IoLogOutOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import { SiLetterboxd } from "react-icons/si";

import type { TasteProfile } from "@/utils/personalization/taste-engine";

const TASTE_STORAGE_KEY = "ryuflix_taste_profile";

type TMDBAccount = {
  id: string | number | null;
  objectId?: string | null;
  username: string | null;
  name: string | null;
};

type TMDBStatus = {
  connected: boolean;
  account?: TMDBAccount;
};

type TMDBImportResult = {
  importedAt: string;

  account: TMDBAccount;

  totals: {
    ratedMovies: number;
    ratedTV: number;
    favoritesMovies: number;
    favoritesTV: number;
    watchlistMovies: number;
    watchlistTV: number;
  };

  samples: {
    ratedMovies: {
      id: number;
      title: string | null;
      rating: number | null;
      userRating: number | null;
      releaseDate: string | null;
    }[];

    ratedTV: {
      id: number;
      title: string | null;
      rating: number | null;
      userRating: number | null;
      releaseDate: string | null;
    }[];
  };

  tasteProfile: TasteProfile;
};

type StoredTasteProfile = {
  provider: "tmdb";
  importedAt: string;
  version: number;
  tasteProfile: TasteProfile;
};

const formatScore = (score: number) => {
  if (Number.isInteger(score)) {
    return String(score);
  }

  return score.toFixed(1);
};

const formatImportedDate = (date: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return date;
  }
};

const SignalPill = ({
  name,
  score,
}: {
  name: string;
  score?: number;
}) => {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-default-200 bg-default-50/60 px-4 py-3">
      <span className="truncate text-sm font-medium">
        {name}
      </span>

      {typeof score === "number" && (
        <span
          className={
            score >= 0
              ? "shrink-0 text-xs font-semibold text-primary"
              : "shrink-0 text-xs font-semibold text-danger"
          }
        >
          {score >= 0 ? "+" : ""}
          {formatScore(score)}
        </span>
      )}
    </div>
  );
};

const EmptyState = ({
  text,
}: {
  text: string;
}) => {
  return (
    <div className="rounded-xl border border-dashed border-default-200 px-4 py-6 text-center text-sm text-default-500">
      {text}
    </div>
  );
};

const PersonalizePage = () => {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [tmdb, setTmdb] =
    useState<TMDBStatus>({
      connected: false,
    });

  const [tmdbLoading, setTmdbLoading] =
    useState(true);

  const [disconnecting, setDisconnecting] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  const [importResult, setImportResult] =
    useState<TMDBImportResult | null>(null);

  const [savedProfile, setSavedProfile] =
    useState<StoredTasteProfile | null>(
      null,
    );

  const [importError, setImportError] =
    useState<string | null>(null);

  /*
   * Load the locally stored taste profile.
   *
   * RyuFlix does not use a RyuFlix account
   * for personalization.
   */
  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(
          TASTE_STORAGE_KEY,
        );

      if (!stored) return;

      const parsed =
        JSON.parse(stored) as StoredTasteProfile;

      if (
        parsed &&
        parsed.provider === "tmdb" &&
        parsed.tasteProfile
      ) {
        setSavedProfile(parsed);
      }
    } catch (error) {
      console.error(
        "Failed to load local taste profile:",
        error,
      );

      window.localStorage.removeItem(
        TASTE_STORAGE_KEY,
      );
    }
  }, []);

  const loadTMDBStatus =
    async () => {
      try {
        const response =
          await fetch(
            "/api/tmdb/status",
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          setTmdb({
            connected: false,
          });

          return;
        }

        const data =
          await response.json();

        setTmdb(data);
      } catch (error) {
        console.error(
          "Failed to load TMDB status:",
          error,
        );

        setTmdb({
          connected: false,
        });
      } finally {
        setTmdbLoading(false);
      }
    };

  useEffect(() => {
    loadTMDBStatus();
  }, []);

  const handleFiles = (
    files: FileList | null,
  ) => {
    if (!files) return;

    const validFiles =
      Array.from(files).filter(
        (file) => {
          const name =
            file.name.toLowerCase();

          return (
            name.endsWith(".csv") ||
            name.endsWith(".json")
          );
        },
      );

    setSelectedFiles(validFiles);
  };

  const connectTMDB = () => {
    window.location.href =
      "/api/tmdb/connect";
  };

  const disconnectTMDB =
    async () => {
      setDisconnecting(true);
      setImportResult(null);
      setImportError(null);

      try {
        await fetch(
          "/api/tmdb/disconnect",
          {
            method: "POST",
          },
        );

        setTmdb({
          connected: false,
        });
      } catch (error) {
        console.error(
          "Failed to disconnect TMDB:",
          error,
        );
      } finally {
        setDisconnecting(false);
      }
    };

  const saveTasteProfile = (
    result: TMDBImportResult,
  ) => {
    const storedProfile:
      StoredTasteProfile = {
      provider: "tmdb",

      importedAt:
        result.importedAt,

      version:
        result.tasteProfile.version,

      tasteProfile:
        result.tasteProfile,
    };

    window.localStorage.setItem(
      TASTE_STORAGE_KEY,
      JSON.stringify(
        storedProfile,
      ),
    );

    setSavedProfile(
      storedProfile,
    );
  };

  const importTMDB = async () => {
    setImporting(true);
    setImportError(null);

    try {
      const response =
        await fetch(
          "/api/tmdb/import",
          {
            method: "POST",
            cache: "no-store",
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to import TMDB data.",
        );
      }

      const result =
        data as TMDBImportResult;

      saveTasteProfile(
        result,
      );

      setImportResult(
        result,
      );
    } catch (error) {
      console.error(
        "Failed to import TMDB data:",
        error,
      );

      setImportError(
        error instanceof Error
          ? error.message
          : "Failed to import TMDB data.",
      );
    } finally {
      setImporting(false);
    }
  };

  const clearLocalTaste =
    () => {
      window.localStorage.removeItem(
        TASTE_STORAGE_KEY,
      );

      setSavedProfile(null);
      setImportResult(null);
      setImportError(null);
    };

  const profile =
    savedProfile?.tasteProfile ??
    importResult?.tasteProfile ??
    null;

  const connectedAccountName =
    tmdb.account?.username ||
    tmdb.account?.name ||
    (tmdb.account?.id !== null &&
    tmdb.account?.id !== undefined
      ? `TMDB #${tmdb.account.id}`
      : "TMDB account connected");

  return (
    <div className="mx-auto w-full max-w-5xl pb-10">
      <div className="flex flex-col gap-8">

        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-default-200 bg-background/70 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative flex flex-col gap-5">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <IoSparkles className="size-7" />
            </div>

            <div className="max-w-3xl">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-primary">
                Personalize RyuFlix
              </p>

              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                Bring your taste with you.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-default-500 sm:text-base">
                Connect the services you
                already use and let RyuFlix
                build a personal taste profile
                from your existing movie and TV
                data.
              </p>
            </div>
          </div>
        </section>

        {/* Saved profile status */}
        {savedProfile && (
          <section className="rounded-2xl border border-success/20 bg-success/5 p-5">
            <div className="flex items-start gap-3">
              <IoCheckmarkCircle className="mt-0.5 size-6 shrink-0 text-success" />

              <div className="min-w-0">
                <p className="font-semibold text-success">
                  Your RyuFlix taste is saved
                </p>

                <p className="mt-1 text-sm text-default-500">
                  Imported{" "}
                  {formatImportedDate(
                    savedProfile.importedAt,
                  )}
                  . Your personalization profile
                  is stored locally in this browser.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Accounts */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Your data
            </h2>

            <p className="mt-1 text-sm text-default-500">
              Import data from services you
              already use.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">

            {/* TMDB */}
            <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#01b4e4]/10 text-lg font-black text-[#01b4e4]">
                    TMDB
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      TMDB
                    </h3>

                    <p className="text-sm text-default-500">
                      Ratings, favourites &
                      watchlists
                    </p>
                  </div>
                </div>

                {tmdbLoading ? (
                  <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-500">
                    Checking...
                  </span>
                ) : tmdb.connected ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                    <IoCheckmarkCircle className="size-4" />
                    Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-500">
                    Not connected
                  </span>
                )}
              </div>

              {tmdb.connected &&
                tmdb.account && (
                  <div className="mt-5 rounded-xl bg-default-100/60 px-4 py-3">
                    <p className="text-xs text-default-500">
                      Connected account
                    </p>

                    <p className="mt-1 font-semibold">
                      {connectedAccountName}
                    </p>
                  </div>
                )}

              {!tmdb.connected ? (
                <button
                  type="button"
                  onClick={connectTMDB}
                  disabled={tmdbLoading}
                  className="mt-6 h-11 w-full rounded-xl bg-[#01b4e4] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Connect TMDB
                </button>
              ) : (
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={importTMDB}
                    disabled={importing}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IoRefreshOutline
                      className={
                        importing
                          ? "size-5 animate-spin"
                          : "size-5"
                      }
                    />

                    {importing
                      ? "Importing your taste..."
                      : savedProfile
                        ? "Refresh TMDB data"
                        : "Import my TMDB taste"}
                  </button>

                  <button
                    type="button"
                    onClick={disconnectTMDB}
                    disabled={
                      disconnecting ||
                      importing
                    }
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-default-100 text-sm font-semibold text-default-700 transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IoLogOutOutline className="size-5" />

                    {disconnecting
                      ? "Disconnecting..."
                      : "Disconnect TMDB"}
                  </button>
                </div>
              )}
            </div>

            {/* Letterboxd */}
            <div className="group rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#00e054]/10 text-[#00e054]">
                    <SiLetterboxd className="size-6" />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Letterboxd
                    </h3>

                    <p className="text-sm text-default-500">
                      Import your existing
                      movie data
                    </p>
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <IoCheckmarkCircle className="size-5 text-success" />
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="mt-6 h-11 w-full rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file${
                      selectedFiles.length === 1
                        ? ""
                        : "s"
                    } selected`
                  : "Import Letterboxd data"}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.json"
                className="hidden"
                onChange={(event) =>
                  handleFiles(
                    event.target.files,
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* Error */}
        {importError && (
          <section className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
            <p className="font-semibold text-danger">
              TMDB import failed
            </p>

            <p className="mt-1 text-sm text-danger/80">
              {importError}
            </p>
          </section>
        )}

        {/* Taste profile */}
        {profile && (
          <section className="flex flex-col gap-5">

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
                  Your taste profile
                </p>

                <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  RyuFlix is starting to know you.
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-default-500">
                  This profile is built from your
                  imported TMDB activity. It will be
                  used by the recommendation system
                  in the next stage.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
                <p className="text-xs font-medium text-default-500">
                  Taste confidence
                </p>

                <div className="mt-1 flex items-end gap-1">
                  <span className="text-3xl font-bold text-primary">
                    {profile.confidence}
                  </span>

                  <span className="pb-1 text-sm text-default-500">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Quick summary */}
            <div className="grid gap-4 sm:grid-cols-3">

              <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
                <p className="text-xs font-medium uppercase tracking-wider text-default-500">
                  You lean toward
                </p>

                <p className="mt-2 text-xl font-semibold">
                  {profile.summary.strongestGenre ??
                    "Still learning"}
                </p>

                <p className="mt-1 text-sm text-default-500">
                  strongest genre signal
                </p>
              </div>

              <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
                <p className="text-xs font-medium uppercase tracking-wider text-default-500">
                  Preferred format
                </p>

                <p className="mt-2 text-xl font-semibold capitalize">
                  {profile.summary.preferredMediaType ===
                  "balanced"
                    ? "Balanced"
                    : profile.summary
                        .preferredMediaType ===
                        "tv"
                      ? "TV"
                      : "Movies"}
                </p>

                <p className="mt-1 text-sm text-default-500">
                  based on your activity
                </p>
              </div>

              <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
                <p className="text-xs font-medium uppercase tracking-wider text-default-500">
                  Favorite era
                </p>

                <p className="mt-2 text-xl font-semibold">
                  {profile.summary.preferredEra ??
                    "Still learning"}
                </p>

                <p className="mt-1 text-sm text-default-500">
                  strongest release-era signal
                </p>
              </div>
            </div>

            {/* Genres + keywords */}
            <div className="grid gap-5 lg:grid-cols-2">

              <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
                <div className="mb-4">
                  <h3 className="font-semibold">
                    Genres you gravitate toward
                  </h3>

                  <p className="mt-1 text-sm text-default-500">
                    The strongest positive genre
                    signals from your activity.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {profile.topGenres.length > 0 ? (
                    profile.topGenres
                      .slice(0, 8)
                      .map((genre) => (
                        <SignalPill
                          key={genre.name}
                          name={genre.name}
                          score={genre.score}
                        />
                      ))
                  ) : (
                    <EmptyState text="Not enough genre data yet." />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
                <div className="mb-4">
                  <h3 className="font-semibold">
                    Themes you keep coming back to
                  </h3>

                  <p className="mt-1 text-sm text-default-500">
                    Keywords extracted from the
                    strongest titles in your history.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {profile.topKeywords.length > 0 ? (
                    profile.topKeywords
                      .slice(0, 8)
                      .map((keyword) => (
                        <SignalPill
                          key={keyword.name}
                          name={keyword.name}
                          score={keyword.score}
                        />
                      ))
                  ) : (
                    <EmptyState text="Not enough keyword data yet." />
                  )}
                </div>
              </div>
            </div>

            {/* Directors + actors */}
            <div className="grid gap-5 lg:grid-cols-2">

              <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
                <div className="mb-4">
                  <h3 className="font-semibold">
                    Directors you seem to like
                  </h3>

                  <p className="mt-1 text-sm text-default-500">
                    RyuFlix will use these signals
                    when ranking future recommendations.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {profile.topDirectors.length > 0 ? (
                    profile.topDirectors
                      .slice(0, 8)
                      .map((director) => (
                        <SignalPill
                          key={director.name}
                          name={director.name}
                          score={director.score}
                        />
                      ))
                  ) : (
                    <EmptyState text="Not enough director data yet." />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
                <div className="mb-4">
                  <h3 className="font-semibold">
                    Actors you seem to like
                  </h3>

                  <p className="mt-1 text-sm text-default-500">
                    Cast preferences will become
                    another recommendation signal.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {profile.topActors.length > 0 ? (
                    profile.topActors
                      .slice(0, 8)
                      .map((actor) => (
                        <SignalPill
                          key={actor.name}
                          name={actor.name}
                          score={actor.score}
                        />
                      ))
                  ) : (
                    <EmptyState text="Not enough actor data yet." />
                  )}
                </div>
              </div>
            </div>

            {/* More profile information */}
            <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
              <div className="mb-4">
                <h3 className="font-semibold">
                  More about your taste
                </h3>

                <p className="mt-1 text-sm text-default-500">
                  Additional signals RyuFlix has
                  extracted for future recommendation
                  ranking.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Languages
                  </p>

                  <p className="mt-1 font-semibold">
                    {Object.keys(
                      profile.preferences
                        .languages,
                    ).length || "None yet"}
                  </p>
                </div>

                <div className="rounded-xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Countries
                  </p>

                  <p className="mt-1 font-semibold">
                    {Object.keys(
                      profile.preferences
                        .countries,
                    ).length || "None yet"}
                  </p>
                </div>

                <div className="rounded-xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Rated titles
                  </p>

                  <p className="mt-1 font-semibold">
                    {profile.analyzed.ratedMovies +
                      profile.analyzed.ratedTV}
                  </p>
                </div>

                <div className="rounded-xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Deeply analyzed
                  </p>

                  <p className="mt-1 font-semibold">
                    {profile.analyzed.enrichedItems}
                  </p>
                </div>
              </div>
            </div>

            {/* Source breakdown */}
            <div className="rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-3">
                <IoCloudUploadOutline className="size-5 text-primary" />

                <div>
                  <h3 className="font-semibold">
                    What RyuFlix analyzed
                  </h3>

                  <p className="text-sm text-default-500">
                    Your profile was generated from
                    the following TMDB activity.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                <div className="rounded-xl border border-default-200 p-4">
                  <p className="text-xs text-default-500">
                    Rated movies
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {profile.analyzed.ratedMovies}
                  </p>
                </div>

                <div className="rounded-xl border border-default-200 p-4">
                  <p className="text-xs text-default-500">
                    Rated TV
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {profile.analyzed.ratedTV}
                  </p>
                </div>

                <div className="rounded-xl border border-default-200 p-4">
                  <p className="text-xs text-default-500">
                    Favorite movies
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {profile.analyzed.favoritesMovies}
                  </p>
                </div>

                <div className="rounded-xl border border-default-200 p-4">
                  <p className="text-xs text-default-500">
                    Favorite TV
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {profile.analyzed.favoritesTV}
                  </p>
                </div>

                <div className="rounded-xl border border-default-200 p-4">
                  <p className="text-xs text-default-500">
                    Movie watchlist
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {profile.analyzed.watchlistMovies}
                  </p>
                </div>

                <div className="rounded-xl border border-default-200 p-4">
                  <p className="text-xs text-default-500">
                    TV watchlist
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {profile.analyzed.watchlistTV}
                  </p>
                </div>
              </div>
            </div>

            {/* Local storage / reset */}
            <section className="rounded-2xl border border-default-200 bg-background/50 p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <IoLockClosedOutline className="mt-0.5 size-5 shrink-0 text-default-500" />

                  <div>
                    <p className="font-medium">
                      Your taste profile stays on this browser
                    </p>

                    <p className="mt-1 text-sm leading-6 text-default-500">
                      RyuFlix stores this personalization
                      profile in localStorage. It is not
                      tied to a RyuFlix login.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearLocalTaste}
                  className="h-10 shrink-0 rounded-xl bg-default-100 px-4 text-sm font-semibold text-default-700 transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  Clear taste profile
                </button>
              </div>
            </section>
          </section>
        )}

        {/* No profile yet */}
        {!profile && !importing && (
          <section className="rounded-3xl border border-default-200 bg-background/50 p-8 text-center backdrop-blur-xl sm:p-12">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <IoSparkles className="size-8" />
            </div>

            <h2 className="mt-5 text-2xl font-semibold">
              Your taste profile is waiting.
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-default-500">
              Connect TMDB and import your activity.
              RyuFlix will analyze your ratings,
              favorites, watchlists and deeper movie
              metadata.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default PersonalizePage;
