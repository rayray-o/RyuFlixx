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

const TASTE_STORAGE_KEY =
  "ryuflix_taste_profile";

type TMDBAccount = {
  id: number;
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
   * RyuFlix does not use a user account
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

      /*
       * Save the complete taste profile
       * locally. Nothing is sent to or
       * stored in a RyuFlix account.
       */
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

        {/* Local profile status */}
        {savedProfile && (
          <section className="rounded-2xl border border-success/20 bg-success/5 p-5">
            <div className="flex items-start gap-3">
              <IoCheckmarkCircle className="mt-0.5 size-6 shrink-0 text-success" />

              <div>
                <p className="font-semibold text-success">
                  Your RyuFlix taste is saved
                </p>

                <p className="mt-1 text-sm text-default-500">
                  Your personalization profile
                  is stored locally in this
                  browser.
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
                      {tmdb.account.username ||
                        tmdb.account.name ||
                        `TMDB #${tmdb.account.id}`}
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

                {selectedFiles.length >
                  0 && (
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
                {selectedFiles.length >
                0
                  ? `${selectedFiles.length} file${
                      selectedFiles.length ===
                      1
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

        {/* Import results */}
        {importResult && (
          <section className="rounded-3xl border border-primary/20 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                  Taste data found
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Your RyuFlix profile is ready.
                </h2>

                <p className="mt-1 text-sm text-default-500">
                  RyuFlix analyzed your TMDB
                  activity and saved the resulting
                  taste profile locally.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  [
                    "Rated movies",
                    importResult.totals
                      .ratedMovies,
                  ],
                  [
                    "Rated TV",
                    importResult.totals
                      .ratedTV,
                  ],
                  [
                    "Movie favourites",
                    importResult.totals
                      .favoritesMovies,
                  ],
                  [
                    "TV favourites",
                    importResult.totals
                      .favoritesTV,
                  ],
                  [
                    "Movie watchlist",
                    importResult.totals
                      .watchlistMovies,
                  ],
                  [
                    "TV watchlist",
                    importResult.totals
                      .watchlistTV,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-default-200 bg-default-50/40 p-4"
                    >
                      <p className="text-2xl font-bold">
                        {value}
                      </p>

                      <p className="mt-1 text-xs text-default-500">
                        {label}
                      </p>
                    </div>
                  ),
                )}
              </div>

              {(importResult.samples
                .ratedMovies.length >
                0 ||
                importResult.samples
                  .ratedTV.length >
                  0) && (
                <div className="grid gap-6 md:grid-cols-2">
                  {importResult.samples
                    .ratedMovies.length >
                    0 && (
                    <div>
                      <h3 className="mb-3 font-semibold">
                        Recent movie ratings
                      </h3>

                      <div className="flex flex-col gap-2">
                        {importResult.samples.ratedMovies
                          .slice(0, 5)
                          .map((movie) => (
                            <div
                              key={movie.id}
                              className="flex items-center justify-between gap-3 rounded-xl bg-default-100/60 px-4 py-3"
                            >
                              <span className="truncate text-sm">
                                {movie.title}
                              </span>

                              <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                {movie.userRating ??
                                  "—"}
                                /10
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {importResult.samples
                    .ratedTV.length >
                    0 && (
                    <div>
                      <h3 className="mb-3 font-semibold">
                        Recent TV ratings
                      </h3>

                      <div className="flex flex-col gap-2">
                        {importResult.samples.ratedTV
                          .slice(0, 5)
                          .map((show) => (
                            <div
                              key={show.id}
                              className="flex items-center justify-between gap-3 rounded-xl bg-default-100/60 px-4 py-3"
                            >
                              <span className="truncate text-sm">
                                {show.title}
                              </span>

                              <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                {show.userRating ??
                                  "—"}
                                /10
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Taste profile preview */}
        {profile && (
          <section className="rounded-3xl border border-default-200 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                  RyuFlix taste engine
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  We know what you tend to like.
                </h2>

                <p className="mt-1 text-sm text-default-500">
                  This profile will power the
                  recommendation system in the
                  next stage.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Strongest genre
                  </p>

                  <p className="mt-2 font-semibold">
                    {profile.summary
                      .strongestGenre ??
                      "Not enough data"}
                  </p>
                </div>

                <div className="rounded-2xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Strongest theme
                  </p>

                  <p className="mt-2 font-semibold">
                    {profile.summary
                      .strongestKeyword ??
                      "Not enough data"}
                  </p>
                </div>

                <div className="rounded-2xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Preferred format
                  </p>

                  <p className="mt-2 font-semibold capitalize">
                    {profile.summary
                      .preferredMediaType}
                  </p>
                </div>

                <div className="rounded-2xl bg-default-100/60 p-4">
                  <p className="text-xs text-default-500">
                    Profile confidence
                  </p>

                  <p className="mt-2 font-semibold">
                    {profile.confidence}%
                  </p>
                </div>
              </div>

              {profile.topGenres.length >
                0 && (
                <div>
                  <h3 className="mb-3 font-semibold">
                    Your strongest genres
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {profile.topGenres
                      .slice(0, 8)
                      .map((genre) => (
                        <span
                          key={genre.name}
                          className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                        >
                          {genre.name}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {profile.topDirectors.length >
                0 && (
                <div>
                  <h3 className="mb-3 font-semibold">
                    Directors you tend to like
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {profile.topDirectors
                      .slice(0, 6)
                      .map((director) => (
                        <span
                          key={director.name}
                          className="rounded-full bg-default-100 px-3 py-1.5 text-sm text-default-700"
                        >
                          {director.name}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Privacy */}
        <section className="rounded-2xl border border-default-200 bg-background/50 p-5">
          <div className="flex items-start gap-3">
            <IoLockClosedOutline className="mt-0.5 size-5 shrink-0 text-default-500" />

            <div className="flex-1">
              <p className="font-medium">
                Your RyuFlix taste stays in this
                browser.
              </p>

              <p className="mt-1 text-sm leading-6 text-default-500">
                The generated personalization
                profile is stored in localStorage.
                RyuFlix does not need a separate
                account for this.
              </p>
            </div>
          </div>

          {savedProfile && (
            <button
              type="button"
              onClick={clearLocalTaste}
              className="mt-4 flex items-center gap-2 rounded-xl bg-default-100 px-4 py-2.5 text-sm font-medium text-default-700 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <IoCloudUploadOutline className="size-4 rotate-180" />
              Clear local taste profile
            </button>
          )}
        </section>

      </div>
    </div>
  );
};

export default PersonalizePage;
