"use client";

import { PlayersProps } from "@/types";
import { useEffect, useMemo, useState } from "react";

interface WatchPlayerProps {
  servers: PlayersProps[];
  selectedServer: number;
  onServerChange: (index: number) => void;
  title?: string;
}

const WatchPlayer: React.FC<WatchPlayerProps> = ({
  servers,
  selectedServer,
  onServerChange,
  title = "Video Player",
}) => {
  const safeIndex =
    servers.length > 0
      ? Math.min(Math.max(selectedServer, 0), servers.length - 1)
      : 0;

  const currentServer = useMemo(
    () => servers[safeIndex],
    [servers, safeIndex],
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [currentServer?.source]);

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
      {/* VIDEO */}
      <div className="w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
        <iframe
          key={`${currentServer.title}-${currentServer.source}`}
          src={currentServer.source}
          title={`${title} — ${currentServer.title}`}
          className="block aspect-video w-full border-0"
          style={{
            pointerEvents: "auto",
            touchAction: "manipulation",
          }}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoading(false)}
        />
      </div>

      {/* LOADING STATUS — NOT OVER THE IFRAME */}
      {loading && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-white/40">
          <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/70" />
          <span>
            Connecting to {currentServer.title}
          </span>
        </div>
      )}

      {/* SERVER CONTROLS */}
      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        style={{
          touchAction: "manipulation",
        }}
      >
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

                setLoading(true);
                onServerChange(index);
              }}
              className={[
                "rounded-xl border px-4 py-2 text-sm font-medium",
                "transition-colors duration-150",
                "focus:outline-none focus:ring-2 focus:ring-white/30",
                "touch-manipulation",
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
