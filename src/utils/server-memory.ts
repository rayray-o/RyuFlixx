"use client";

import { PlayersProps } from "@/types";

export interface LastServerPreference {
  source: string;
  title: string;
  updated_at: string;
}

const SERVER_MEMORY_KEY =
  "ryuflix_last_server_v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function safelyParse<T>(
  value: string | null,
  fallback: T,
): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/*
 * Server URLs can contain temporary resume parameters such as
 * startAt. Those must not make the same server look different.
 */
export function normalizeServerSource(
  source: string,
): string {
  try {
    const url = new URL(source);

    url.searchParams.delete(
      "startAt",
    );

    return url.toString();
  } catch {
    return source;
  }
}

function getAllPreferences(): Record<
  string,
  LastServerPreference
> {
  if (!isBrowser()) {
    return {};
  }

  return safelyParse<
    Record<string, LastServerPreference>
  >(
    window.localStorage.getItem(
      SERVER_MEMORY_KEY,
    ),
    {},
  );
}

export function getLastServer(
  memoryKey: string,
): LastServerPreference | null {
  if (!isBrowser()) {
    return null;
  }

  const all =
    getAllPreferences();

  const preference =
    all[memoryKey];

  if (
    !preference ||
    typeof preference.source !==
      "string" ||
    typeof preference.title !==
      "string"
  ) {
    return null;
  }

  return preference;
}

export function saveLastServer(
  memoryKey: string,
  server: PlayersProps,
) {
  if (!isBrowser()) {
    return;
  }

  if (
    !memoryKey ||
    !server?.source
  ) {
    return;
  }

  const all =
    getAllPreferences();

  all[memoryKey] = {
    source:
      normalizeServerSource(
        server.source,
      ),
    title: server.title,
    updated_at:
      new Date().toISOString(),
  };

  /*
   * Keep the memory bounded even if the user
   * watches hundreds of different titles.
   */
  const entries =
    Object.entries(all)
      .sort(
        (
          [, a],
          [, b],
        ) =>
          new Date(
            b.updated_at,
          ).getTime() -
          new Date(
            a.updated_at,
          ).getTime(),
      )
      .slice(0, 500);

  try {
    window.localStorage.setItem(
      SERVER_MEMORY_KEY,
      JSON.stringify(
        Object.fromEntries(
          entries,
        ),
      ),
    );
  } catch (error) {
    console.error(
      "RyuFlixx: failed to save last server",
      error,
    );
  }
}

/*
 * Find the saved server inside the current server list.
 *
 * Source URL is preferred because server titles are not always
 * unique. Title is only a fallback for providers whose URL changed.
 */
export function findLastServerIndex(
  servers: PlayersProps[],
  preference:
    | LastServerPreference
    | null,
): number | null {
  if (
    !preference ||
    !servers.length
  ) {
    return null;
  }

  const savedSource =
    normalizeServerSource(
      preference.source,
    );

  const sourceIndex =
    servers.findIndex(
      (server) =>
        normalizeServerSource(
          server.source,
        ) === savedSource,
    );

  if (sourceIndex >= 0) {
    return sourceIndex;
  }

  const titleIndex =
    servers.findIndex(
      (server) =>
        server.title ===
        preference.title,
    );

  if (titleIndex >= 0) {
    return titleIndex;
  }

  return null;
    }
