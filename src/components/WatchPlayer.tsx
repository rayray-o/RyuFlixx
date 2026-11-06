"use client";

import type { PlayersProps } from "@/types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  findLastServerIndex,
  getLastServer,
  saveLastServer,
} from "@/utils/server-memory";

interface WatchPlayerProps {
  servers: PlayersProps[];
  selectedServer: number;
  onServerChange: (index: number) => void;
  getCurrentTime?: () => number;
  flushProgress?: () => void;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  title?: string;
  serverMemoryKey: string;
  serverFallbackMemoryKey?: string;
  resumeAt?: number;
}

type ResumeProvider =
  | "vidy"
  | "vidly"
  | "vidrift"
  | "vidsrc"
  | "videasy"
  | "vidcore"
  | null;

function normalizeResumePosition(
  value: number | null | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0;
  }

  return Math.floor(Math.min(value, 8 * 60 * 60));
}

/**
 * Each provider has its own documented resume mechanism.
 * Unknown providers deliberately receive no guessed parameter.
 */
function getResumeProvider(source: string): ResumeProvider {
  try {
    const host = new URL(source).hostname.toLowerCase();

    if (host === "vidy.st" || host === "www.vidy.st") {
      return "vidy";
    }

    if (
      host === "vidly.pro" ||
      host === "embed.filmu.in"
    ) {
      return "vidly";
    }

    if (
      host === "embed.vidrift.net" ||
      host === "embed.vidrift.in"
    ) {
      return "vidrift";
    }

    if (
      host === "vidsrc.sh" ||
      host === "vidsrc2.ru" ||
      host === "vidsrc.ir"
    ) {
      return "vidsrc";
    }

    if (host === "player.videasy.ws") {
      return "videasy";
    }

    if (host === "vidcore.org") {
      return "vidcore";
    }

    return null;
  } catch {
    return null;
  }
}

function buildResumableSource(
  source: string,
  position: number,
): string {
  try {
    const url = new URL(source);
    const provider = getResumeProvider(source);
    const timestamp = normalizeResumePosition(position);

    // Never leave a stale parameter from another provider.
    url.searchParams.delete("progress");
    url.searchParams.delete("startAt");
    url.searchParams.delete("t");

    if (timestamp <= 0) {
      return url.toString();
    }

    switch (provider) {
      case "vidy":
        // Vidy's documented resume parameter.
        url.searchParams.set(
          "progress",
          String(timestamp),
        );
        break;

      case "vidly":
        // Vidly's documented start-position parameter.
        url.searchParams.set(
          "t",
          String(timestamp),
        );
        break;

      case "vidsrc":
      case "videasy":
      case "vidcore":
        // These providers document startAt in seconds.
        url.searchParams.set(
          "startAt",
          String(timestamp),
        );
        break;

      case "vidrift":
        // VidRift uses postMessage, not a URL parameter.
        break;

      default:
        // No undocumented generic fallback.
        break;
    }

    return url.toString();
  } catch {
    return source;
  }
}

const WatchPlayer: React.FC<WatchPlayerProps> = ({
  servers,
  selectedServer,
  onServerChange,
  getCurrentTime,
  flushProgress,
  iframeRef,
  title = "Video Player",
  serverMemoryKey,
  serverFallbackMemoryKey,
  resumeAt = 0,
}) => {
  const safeIndex = servers.length > 0
    ? Math.min(
        Math.max(
          Number.isFinite(selectedServer)
            ? selectedServer
            : 0,
          0,
        ),
        servers.length - 1,
      )
    : 0;

  const currentServer = useMemo(
    () => servers[safeIndex],
    [servers, safeIndex],
  );

  const [loading, setLoading] = useState(true);
  const [handoffPosition, setHandoffPosition] =
    useState<number | null>(null);

  const internalIframeRef =
    useRef<HTMLIFrameElement | null>(null);

  const restoredMemoryRef = useRef(false);
  const resumeTimersRef = useRef<number[]>([]);
  const fallbackKeyRef = useRef(serverMemoryKey);
  const previousServerIndexRef = useRef(safeIndex);

  const initialPosition =
    normalizeResumePosition(resumeAt);

  const livePosition =
    normalizeResumePosition(getCurrentTime?.());

  const activeResumePosition =
    livePosition > 0
      ? livePosition
      : normalizeResumePosition(
          handoffPosition ?? initialPosition,
        );

  const serverSignature = useMemo(
    () =>
      servers
        .map(
          (server) =>
            `${server.title}|${server.source}`,
        )
        .join("||"),
    [servers],
  );

  const setIframeRef = useCallback(
    (element: HTMLIFrameElement | null) => {
      internalIframeRef.current = element;

      if (iframeRef) {
        iframeRef.current = element;
      }
    },
    [iframeRef],
  );

  const clearResumeTimers = useCallback(() => {
    for (const timer of resumeTimersRef.current) {
      window.clearTimeout(timer);
    }

    resumeTimersRef.current = [];
  }, []);

  // Reset media-specific handoff state when the media changes.
  useEffect(() => {
    if (fallbackKeyRef.current !== serverMemoryKey) {
      fallbackKeyRef.current = serverMemoryKey;
      restoredMemoryRef.current = false;
      previousServerIndexRef.current = safeIndex;
      setHandoffPosition(null);
    }
  }, [serverMemoryKey, safeIndex]);

  // Restore the remembered server.
  useEffect(() => {
    if (
      restoredMemoryRef.current ||
      !servers.length ||
      !serverMemoryKey
    ) {
      return;
    }

    restoredMemoryRef.current = true;

    if (typeof window === "undefined") return;

    const search = new URLSearchParams(
      window.location.search,
    );

    if (search.has("src")) return;

    let preference = getLastServer(serverMemoryKey);

    if (!preference && serverFallbackMemoryKey) {
      preference = getLastServer(
        serverFallbackMemoryKey,
      );
    }

    const rememberedIndex = findLastServerIndex(
      servers,
      preference,
    );

    if (
      rememberedIndex === null ||
      rememberedIndex === safeIndex
    ) {
      return;
    }

    onServerChange(rememberedIndex);
  }, [
    serverMemoryKey,
    serverFallbackMemoryKey,
    serverSignature,
    servers,
    safeIndex,
    onServerChange,
  ]);

  // Remember the selected server.
  useEffect(() => {
    if (!currentServer || !serverMemoryKey) return;

    saveLastServer(serverMemoryKey, currentServer);

    if (serverFallbackMemoryKey) {
      saveLastServer(
        serverFallbackMemoryKey,
        currentServer,
      );
    }
  }, [
    currentServer,
    serverMemoryKey,
    serverFallbackMemoryKey,
  ]);

  // Persist server preference when leaving the page.
  useEffect(() => {
    const saveCurrentServer = () => {
      if (!currentServer || !serverMemoryKey) return;

      saveLastServer(serverMemoryKey, currentServer);

      if (serverFallbackMemoryKey) {
        saveLastServer(
          serverFallbackMemoryKey,
          currentServer,
        );
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        saveCurrentServer();
      }
    };

    window.addEventListener(
      "pagehide",
      saveCurrentServer,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    return () => {
      saveCurrentServer();

      window.removeEventListener(
        "pagehide",
        saveCurrentServer,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, [
    currentServer,
    serverMemoryKey,
    serverFallbackMemoryKey,
  ]);

  // Catch source changes from both the player buttons
  // and the separate source-selection drawer.
  useEffect(() => {
    if (
      previousServerIndexRef.current === safeIndex
    ) {
      return;
    }

    previousServerIndexRef.current = safeIndex;

    flushProgress?.();

    const latestPosition =
      normalizeResumePosition(getCurrentTime?.());

    if (latestPosition > 0) {
      setHandoffPosition(latestPosition);
    }
  }, [
    safeIndex,
    flushProgress,
    getCurrentTime,
  ]);

  const iframeSource = useMemo(() => {
    if (!currentServer) return "";

    return buildResumableSource(
      currentServer.source,
      activeResumePosition,
    );
  }, [
    currentServer?.source,
    activeResumePosition,
  ]);

  useEffect(() => {
    setLoading(true);
    clearResumeTimers();

    if (iframeRef) {
      iframeRef.current = null;
    }

    return clearResumeTimers;
  }, [
    iframeSource,
    iframeRef,
    clearResumeTimers,
  ]);

  // VidRift's documented resume API is postMessage.
  const sendVidRiftResume = useCallback(
    (frame: HTMLIFrameElement) => {
      if (
        !currentServer ||
        activeResumePosition <= 0 ||
        getResumeProvider(currentServer.source) !== "vidrift"
      ) {
        return;
      }

      let targetOrigin: string;

      try {
        targetOrigin = new URL(
          currentServer.source,
        ).origin;
      } catch {
        return;
      }

      const send = () => {
        if (
          !frame.isConnected ||
          internalIframeRef.current !== frame
        ) {
          return;
        }

        frame.contentWindow?.postMessage(
          {
            type: "vidrift:resume",
            currentTime: activeResumePosition,
          },
          targetOrigin,
        );
      };

      send();

      for (const delay of [350, 1000, 2200]) {
        const timer = window.setTimeout(
          send,
          delay,
        );

        resumeTimersRef.current.push(timer);
      }
    },
    [
      currentServer?.source,
      activeResumePosition,
    ],
  );

  const handleIframeLoad = useCallback(
    (
      event: React.SyntheticEvent<HTMLIFrameElement>,
    ) => {
      setLoading(false);
      sendVidRiftResume(event.currentTarget);
    },
    [sendVidRiftResume],
  );

  if (!currentServer) {
    return (
      <section className="w-full">
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-black text-sm text-white/50 ring-1 ring-white/10">
          No video server available.
        </div>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
        <iframe
          ref={setIframeRef}
          key={`${currentServer.title}-${iframeSource}`}
          src={iframeSource}
          title={`${title} — ${currentServer.title}`}
          className="absolute inset-0 block h-full w-full border-0"
          allow="autoplay *; fullscreen *; picture-in-picture; encrypted-media; accelerometer; gyroscope"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={handleIframeLoad}
        />

        {loading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-md">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />

              <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                Connecting
              </span>

              <span className="text-xs text-white/40">
                {currentServer.title}
              </span>

              {activeResumePosition > 0 && (
                <span className="text-[10px] text-white/50">
                  Resume requested at{" "}
                  {Math.floor(
                    activeResumePosition / 60,
                  )}
                  :
                  {String(
                    activeResumePosition % 60,
                  ).padStart(2, "0")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-widest text-white/40">
          Server
        </span>

        {servers.map((server, index) => {
          const active = index === safeIndex;

          return (
            <button
              key={`${server.title}-${index}`}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (active) return;

                flushProgress?.();

                const latestPosition =
                  normalizeResumePosition(
                    getCurrentTime?.(),
                  );

                const bestPosition =
                  latestPosition > 0
                    ? latestPosition
                    : normalizeResumePosition(
                        handoffPosition ??
                          initialPosition,
                      );

                if (bestPosition > 0) {
                  setHandoffPosition(bestPosition);
                }

                if (serverMemoryKey) {
                  saveLastServer(
                    serverMemoryKey,
                    server,
                  );
                }

                if (serverFallbackMemoryKey) {
                  saveLastServer(
                    serverFallbackMemoryKey,
                    server,
                  );
                }

                setLoading(true);
                clearResumeTimers();
                onServerChange(index);
              }}
              className={[
                "rounded-xl border px-4 py-2 text-sm font-medium",
                "transition-colors duration-150",
                "focus:outline-none focus:ring-2 focus:ring-white/30",
                active
                  ? "border-white/30 bg-white/15 text-white shadow-lg"
                  : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                {server.title}

                {server.recommended && (
                  <span className="text-[9px] uppercase tracking-wider text-white/40">
                    Recommended
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

WatchPlayer.displayName = "WatchPlayer";

export default WatchPlayer;
