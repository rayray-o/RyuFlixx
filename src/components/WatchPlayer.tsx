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
  flushProgress?: () => void | Promise<boolean | void>;
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
  | "vidstuck"
  | "2embed"
  | null;

function normalizeResumePosition(value: number | null | undefined): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0;
  }

  return Math.floor(Math.min(value, 8 * 60 * 60));
}

function getResumeProvider(source: string): ResumeProvider {
  try {
    const host = new URL(source).hostname.toLowerCase();

    if (host === "vidy.st" || host === "www.vidy.st") return "vidy";

    if (host === "vidly.pro" || host === "embed.filmu.in") return "vidly";

    if (host === "embed.vidrift.net" || host === "embed.vidrift.in") {
      return "vidrift";
    }

    if ([
      "vidsrc.sh",
      "vidsrc2.ru",
      "vidsrc.ir",
      "vidsrcme.ir",
      "vidsrcme.ru",
      "vidsrcme.su",
      "vidsrc-me.ru",
      "vidsrc-me.ir",
      "vidsrc.in",
      "vidsrc.ru",
      "vidsrc.su",
    ].includes(host)) {
      return "vidsrc";
    }

    if (host === "player.videasy.ws" || host === "player.videasy.to") {
      return "videasy";
    }

    if (host === "vidcore.org" || host === "vidcore.io") return "vidcore";

    if (host === "vidstuck.cc" || host === "vidstuck.xyz") return "vidstuck";

    if (host === "2embed.cc" || host === "www.2embed.cc") return "2embed";

    return null;
  } catch {
    return null;
  }
}

function buildResumableSource(source: string, position: number): string {
  try {
    const url = new URL(source);
    const provider = getResumeProvider(source);
    const timestamp = normalizeResumePosition(position);

    url.searchParams.delete("progress");
    url.searchParams.delete("startAt");
    url.searchParams.delete("t");

    if (timestamp <= 0) return url.toString();

    switch (provider) {
      case "vidy":
      case "vidstuck":
        url.searchParams.set("progress", String(timestamp));
        break;

      case "vidly":
        url.searchParams.set("t", String(timestamp));
        break;

      case "vidsrc":
      case "videasy":
      case "vidcore":
      case "2embed":
        url.searchParams.set("startAt", String(timestamp));
        break;

      case "vidrift":
      default:
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
        Math.max(Number.isFinite(selectedServer) ? selectedServer : 0, 0),
        servers.length - 1,
      )
    : 0;

  const currentServer = useMemo(
    () => servers[safeIndex],
    [servers, safeIndex],
  );

  const [loading, setLoading] = useState(true);
  const [handoffPosition, setHandoffPosition] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);

  const internalIframeRef = useRef<HTMLIFrameElement | null>(null);
  const restoredMemoryRef = useRef(false);
  const resumeTimersRef = useRef<number[]>([]);
  const fallbackKeyRef = useRef(serverMemoryKey);
  const previousServerIndexRef = useRef(safeIndex);
  const switchLockRef = useRef(false);

  const initialPosition = normalizeResumePosition(resumeAt);
  const livePosition = normalizeResumePosition(getCurrentTime?.());

  const activeResumePosition = livePosition > 0
    ? livePosition
    : normalizeResumePosition(handoffPosition ?? initialPosition);

  const serverSignature = useMemo(
    () => servers.map((server) => `${server.title}|${server.source}`).join("||"),
    [servers],
  );

  const setIframeRef = useCallback((element: HTMLIFrameElement | null) => {
    internalIframeRef.current = element;

    if (iframeRef) iframeRef.current = element;
  }, [iframeRef]);

  const clearResumeTimers = useCallback(() => {
    resumeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    resumeTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (fallbackKeyRef.current !== serverMemoryKey) {
      fallbackKeyRef.current = serverMemoryKey;
      restoredMemoryRef.current = false;
      previousServerIndexRef.current = safeIndex;
      setHandoffPosition(null);
    }
  }, [serverMemoryKey, safeIndex]);

  useEffect(() => {
    if (restoredMemoryRef.current || !servers.length || !serverMemoryKey) return;

    restoredMemoryRef.current = true;

    if (typeof window === "undefined") return;

    const search = new URLSearchParams(window.location.search);
    if (search.has("src")) return;

    let preference = getLastServer(serverMemoryKey);

    if (!preference && serverFallbackMemoryKey) {
      preference = getLastServer(serverFallbackMemoryKey);
    }

    const rememberedIndex = findLastServerIndex(servers, preference);

    if (rememberedIndex === null || rememberedIndex === safeIndex) return;

    onServerChange(rememberedIndex);
  }, [
    serverMemoryKey,
    serverFallbackMemoryKey,
    serverSignature,
    servers,
    safeIndex,
    onServerChange,
  ]);

  useEffect(() => {
    if (!currentServer || !serverMemoryKey) return;

    saveLastServer(serverMemoryKey, currentServer);

    if (serverFallbackMemoryKey) {
      saveLastServer(serverFallbackMemoryKey, currentServer);
    }
  }, [currentServer, serverMemoryKey, serverFallbackMemoryKey]);

  useEffect(() => {
    const saveCurrentServer = () => {
      if (!currentServer || !serverMemoryKey) return;

      saveLastServer(serverMemoryKey, currentServer);

      if (serverFallbackMemoryKey) {
        saveLastServer(serverFallbackMemoryKey, currentServer);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveCurrentServer();
    };

    window.addEventListener("pagehide", saveCurrentServer);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      saveCurrentServer();
      window.removeEventListener("pagehide", saveCurrentServer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentServer, serverMemoryKey, serverFallbackMemoryKey]);

  useEffect(() => {
    if (previousServerIndexRef.current === safeIndex) return;

    previousServerIndexRef.current = safeIndex;
    switchLockRef.current = false;
    setSwitching(false);
    setLoading(true);

    clearResumeTimers();

    const latestPosition = normalizeResumePosition(getCurrentTime?.());

    if (latestPosition > 0) {
      setHandoffPosition(latestPosition);
    }
  }, [safeIndex, getCurrentTime, clearResumeTimers]);

  const iframeSource = useMemo(() => {
    if (!currentServer) return "";

    return buildResumableSource(currentServer.source, activeResumePosition);
  }, [currentServer?.source, activeResumePosition]);

  useEffect(() => {
    setLoading(true);
    clearResumeTimers();

    return clearResumeTimers;
  }, [iframeSource, clearResumeTimers]);

  const sendVidRiftResume = useCallback((frame: HTMLIFrameElement) => {
    if (
      !currentServer ||
      activeResumePosition <= 0 ||
      getResumeProvider(currentServer.source) !== "vidrift"
    ) {
      return;
    }

    let targetOrigin: string;

    try {
      targetOrigin = new URL(currentServer.source).origin;
    } catch {
      return;
    }

    const send = () => {
      if (!frame.isConnected || internalIframeRef.current !== frame) return;

      frame.contentWindow?.postMessage(
        {
          type: "vidrift:resume",
          currentTime: activeResumePosition,
        },
        targetOrigin,
      );
    };

    send();

    [350, 1000, 2200].forEach((delay) => {
      const timer = window.setTimeout(send, delay);
      resumeTimersRef.current.push(timer);
    });
  }, [currentServer?.source, activeResumePosition]);

  const handleIframeLoad = useCallback((
    event: React.SyntheticEvent<HTMLIFrameElement>,
  ) => {
    setLoading(false);
    sendVidRiftResume(event.currentTarget);
  }, [sendVidRiftResume]);

  const changeServer = useCallback(async (index: number) => {
    if (
      index === safeIndex ||
      switchLockRef.current ||
      !servers[index]
    ) {
      return;
    }

    switchLockRef.current = true;
    setSwitching(true);

    // flushProgress waits for a fresh provider event before it saves.
    // If the provider does not report progress, the last known position
    // remains the best available fallback.
    try {
      await flushProgress?.();
    } catch (error) {
      console.error("RyuFlixx: progress flush failed during server switch", error);
    }

    const latestPosition = normalizeResumePosition(getCurrentTime?.());

    const bestPosition = latestPosition > 0
      ? latestPosition
      : normalizeResumePosition(handoffPosition ?? initialPosition);

    if (bestPosition > 0) {
      setHandoffPosition(bestPosition);
    }

    const nextServer = servers[index];

    if (serverMemoryKey) {
      saveLastServer(serverMemoryKey, nextServer);
    }

    if (serverFallbackMemoryKey) {
      saveLastServer(serverFallbackMemoryKey, nextServer);
    }

    setLoading(true);
    clearResumeTimers();

    onServerChange(index);
  }, [
    safeIndex,
    servers,
    flushProgress,
    getCurrentTime,
    handoffPosition,
    initialPosition,
    serverMemoryKey,
    serverFallbackMemoryKey,
    clearResumeTimers,
    onServerChange,
  ]);

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

        {(loading || switching) && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-md">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />

              <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                {switching ? "Saving progress" : "Connecting"}
              </span>

              <span className="text-xs text-white/40">
                {currentServer.title}
              </span>

              {activeResumePosition > 0 && (
                <span className="text-[10px] text-white/50">
                  Resume requested at{" "}
                  {Math.floor(activeResumePosition / 60)}:
                  {String(activeResumePosition % 60).padStart(2, "0")}
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
              disabled={switching}
              onClick={() => void changeServer(index)}
              className={[
                "rounded-xl border px-4 py-2 text-sm font-medium",
                "transition-colors duration-150",
                "focus:outline-none focus:ring-2 focus:ring-white/30",
                active
                  ? "border-white/30 bg-white/15 text-white shadow-lg"
                  : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
                switching ? "cursor-wait opacity-60" : "",
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
