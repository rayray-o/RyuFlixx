"use client";

import { useRef, useState } from "react";
import { IoSparkles, IoCloudUploadOutline, IoCheckmarkCircle, IoLockClosedOutline } from "react-icons/io5";
import { SiLetterboxd } from "react-icons/si";

const PersonalizePage = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter((file) => {
      const name = file.name.toLowerCase();

      return (
        name.endsWith(".csv") ||
        name.endsWith(".json")
      );
    });

    setSelectedFiles(validFiles);
  };

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
                Connect your movie accounts and import your existing ratings,
                watch history and watchlists. RyuFlix will use that information
                to build a much more personal discovery experience.
              </p>
            </div>
          </div>
        </section>

        {/* Connected accounts */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">Your accounts</h2>
            <p className="mt-1 text-sm text-default-500">
              Connect services you already use.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* TMDB */}
            <div className="group rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#01b4e4]/10 text-lg font-black text-[#01b4e4]">
                    TMDB
                  </div>

                  <div>
                    <h3 className="font-semibold">TMDB</h3>
                    <p className="text-sm text-default-500">
                      Ratings, favourites & watchlists
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-500">
                  Coming next
                </span>
              </div>

              <button
                type="button"
                disabled
                className="mt-6 h-11 w-full rounded-xl bg-default-100 text-sm font-semibold text-default-400"
              >
                Connect TMDB
              </button>
            </div>

            {/* Letterboxd */}
            <div className="group rounded-2xl border border-default-200 bg-background/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#00e054]/10 text-[#00e054]">
                    <SiLetterboxd className="size-6" />
                  </div>

                  <div>
                    <h3 className="font-semibold">Letterboxd</h3>
                    <p className="text-sm text-default-500">
                      Import your existing movie data
                    </p>
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <IoCheckmarkCircle className="size-5 text-success" />
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 h-11 w-full rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`
                  : "Import Letterboxd data"}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.json"
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />
            </div>
          </div>
        </section>

        {/* Import area */}
        <section className="rounded-3xl border border-default-200 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold">Import your history</h2>
              <p className="mt-1 text-sm leading-6 text-default-500">
                Have a Letterboxd export? Select its CSV or JSON files here.
                Your files stay in this browser for now; the actual profile
                processing will be added in the next stage.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-default-300 bg-default-50/40 px-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IoCloudUploadOutline className="size-7" />
              </div>

              <p className="font-semibold">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} files ready`
                  : "Choose your Letterboxd export"}
              </p>

              <p className="mt-2 max-w-md text-xs leading-5 text-default-500">
                CSV and JSON files are accepted in Stage 1.
              </p>
            </button>

            {selectedFiles.length > 0 && (
              <div className="rounded-2xl bg-default-100/70 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-default-500">
                  Selected files
                </p>

                <div className="flex flex-col gap-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-4 py-3"
                    >
                      <span className="truncate text-sm">
                        {file.name}
                      </span>

                      <span className="shrink-0 text-xs text-default-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* What RyuFlix will learn */}
        <section className="rounded-3xl border border-default-200 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IoSparkles className="size-5" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                What RyuFlix will learn
              </h2>

              <p className="mt-1 text-sm leading-6 text-default-500">
                We won't reduce your taste to a single genre. Your imported
                data will eventually be combined with TMDB metadata to build a
                much richer profile.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Ratings",
              "Watch history",
              "Watchlists",
              "Genres",
              "Keywords & themes",
              "Directors & cast",
              "Languages",
              "Release eras",
              "Movie & TV preferences",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-default-200 bg-background/50 px-4 py-3 text-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <div className="flex items-center justify-center gap-2 px-4 text-center text-xs text-default-400">
          <IoLockClosedOutline className="size-4 shrink-0" />
          <span>
            Your imported files are handled locally during this stage.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PersonalizePage;
