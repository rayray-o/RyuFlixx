"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayersProps } from "@/types";
import { RyuFlixPlayer } from "@/components/ui/player/RyuFlixPlayer";

interface WatchPlayerProps {
  servers: PlayersProps[];
  selectedServer: number;
  onServerChange: (index: number) => void;
  getCurrentTime: () => number;
  flushProgress: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  title?: string;
}

const RYUFLIX_TEST_HLS =
  "https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM.m3u8";

const RYUFLIX_CUSTOM_PLAYER_SERVER = 11;

const addResumePosition = (url: string, startAt?: number) => {
  if (!startAt || startAt <= 0) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("startAt", String(Math.floor(startAt)));
    return parsed.toString();
  } catch {
    return url;
  }
};

const ServerButton = ({
  server,
  index,
  selected,
  onClick,
}: {
  server: PlayersProps;
  index: number;
  selected: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
        selected
          ? "bg-white text-black"
          : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
      }`}
    >
      {server.title || `Server ${index + 1}`}
    </button>
  );
};

export default function WatchPlayer({
  servers,
  selectedServer,
  onServerChange,
  getCurrentTime,
  flushProgress,
  iframeRef,
  title,
}: WatchPlayerProps) {
  const safeServerIndex =
    selectedServer >= 0 && selectedServer < servers.length
      ? selectedServer
      : 0;

  const currentServer = servers[safeServerIndex];

  const currentSource = useMemo(() => {
    if (!currentServer) {
      return "";
    }

    return addResumePosition(currentServer.source, getCurrentTime());
  }, [currentServer, getCurrentTime]);

  const [handoffPosition, setHandoffPosition] = useState(0);

  const internalIframeRef = useRef<HTMLIFrameElement | null>(null);

  const setIframeRef = (element: HTMLIFrameElement | null) => {
    internalIframeRef.current = element;

    if (typeof iframeRef === "object" && iframeRef !== null) {
      iframeRef.current = element;
    }
  };

  useEffect(() => {
    setHandoffPosition(0);
  }, [servers.length]);

  useEffect(() => {
    setHandoffPosition(0);
  }, [safeServerIndex]);

  const isCustomPlayer =
    safeServerIndex === RYUFLIX_CUSTOM_PLAYER_SERVER;

  const handleServerChange = (index: number) => {
    if (index === safeServerIndex) {
      return;
    }

    const nativeVideo = isCustomPlayer
      ? document.querySelector<HTMLVideoElement>(".ryu-player__video")
      : null;

    const currentPosition =
      nativeVideo && Number.isFinite(nativeVideo.currentTime)
        ? nativeVideo.currentTime
        : getCurrentTime();

    setHandoffPosition(
      Number.isFinite(currentPosition) ? Math.max(0, currentPosition) : 0,
    );

    flushProgress();
    onServerChange(index);
  };

  if (!currentServer && !isCustomPlayer) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-black text-sm text-white/60">
        No playback server available.
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black">
      <div className="relative aspect-video w-full">
        {isCustomPlayer ? (
          <RyuFlixPlayer
            src={RYUFLIX_TEST_HLS}
            title={title}
            resumeAt={handoffPosition}
            onTimeUpdate={() => {}}
            onEnded={() => {
              flushProgress();
            }}
          />
        ) : (
          <iframe
            ref={setIframeRef}
            key={`${safeServerIndex}-${currentSource}`}
            src={currentSource}
            title={title || "RyuFlix Player"}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen={false}
            referrerPolicy="origin"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/90 p-3">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
          Servers
        </span>

        {servers.map((server, index) => (
          <ServerButton
            key={`${server.title}-${index}`}
            server={server}
            index={index}
            selected={index === safeServerIndex}
            onClick={() => handleServerChange(index)}
          />
        ))}

        <span className="ml-auto rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          {isCustomPlayer ? "RyuFlix Player" : "External Player"}
        </span>
      </div>
    </div>
  );
}
