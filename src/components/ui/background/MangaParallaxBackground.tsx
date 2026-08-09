"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CROSSFADE_TIME = 0.65;

function VideoPair({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);

  const active = useRef<"a" | "b">("a");
  const transitioning = useRef(false);

  useEffect(() => {
    const a = videoA.current;
    const b = videoB.current;

    if (!a || !b) return;

    let destroyed = false;
    let transitionTimer: number | null = null;

    a.currentTime = 0;
    b.currentTime = 0;

    a.style.opacity = "1";
    b.style.opacity = "0";

    const startCurrentVideo = () => {
      const current = active.current === "a" ? a : b;

      current.play().catch(() => {});
    };

    startCurrentVideo();

    const startNext = async () => {
      if (destroyed || transitioning.current) {
        return;
      }

      const current =
        active.current === "a" ? a : b;

      const next =
        active.current === "a" ? b : a;

      transitioning.current = true;

      next.pause();
      next.currentTime = 0;

      try {
        await next.play();
      } catch {
        transitioning.current = false;
        return;
      }

      next.style.transition =
        `opacity ${CROSSFADE_TIME}s linear`;

      current.style.transition =
        `opacity ${CROSSFADE_TIME}s linear`;

      next.style.opacity = "1";
      current.style.opacity = "0";

      transitionTimer = window.setTimeout(() => {
        if (destroyed) {
          return;
        }

        current.pause();
        current.currentTime = 0;

        active.current =
          active.current === "a" ? "b" : "a";

        transitioning.current = false;
      }, CROSSFADE_TIME * 1000);
    };

    const handleTimeUpdate = (
      event: Event
    ) => {
      const current =
        event.currentTarget as HTMLVideoElement;

      if (!Number.isFinite(current.duration)) {
        return;
      }

      const remaining =
        current.duration - current.currentTime;

      if (
        remaining <= CROSSFADE_TIME &&
        remaining > 0
      ) {
        startNext();
      }
    };

    const handleEnded = () => {
      if (!transitioning.current) {
        startNext();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      startCurrentVideo();
    };

    a.addEventListener(
      "timeupdate",
      handleTimeUpdate
    );

    b.addEventListener(
      "timeupdate",
      handleTimeUpdate
    );

    a.addEventListener(
      "ended",
      handleEnded
    );

    b.addEventListener(
      "ended",
      handleEnded
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      destroyed = true;

      if (transitionTimer !== null) {
        window.clearTimeout(transitionTimer);
      }

      a.pause();
      b.pause();

      a.removeEventListener(
        "timeupdate",
        handleTimeUpdate
      );

      b.removeEventListener(
        "timeupdate",
        handleTimeUpdate
      );

      a.removeEventListener(
        "ended",
        handleEnded
      );

      b.removeEventListener(
        "ended",
        handleEnded
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{
        contain: "strict",
      }}
    >
      <video
        ref={videoA}
        src={src}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: 1,
          willChange: "opacity",
          pointerEvents: "none",
        }}
      />

      <video
        ref={videoB}
        src={src}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: 0,
          willChange: "opacity",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function MangaParallaxBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 h-[100dvh] w-[100vw] overflow-hidden bg-black"
      style={{
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100dvh",
        transform: "translate3d(0, 0, 0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Desktop wallpaper */}
      <VideoPair
        src="/Desktop-RyuFlix.mp4"
        className="hidden md:block"
      />

      {/* Mobile wallpaper */}
      <VideoPair
        src="/Phone-RyuFlix.mp4"
        className="block md:hidden"
      />

      {/* Main cinematic darkness */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(0,0,0,0.78) 0%,
              rgba(0,0,0,0.24) 28%,
              rgba(0,0,0,0.40) 58%,
              rgba(0,0,0,0.94) 100%
            )
          `,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse at center,
              transparent 12%,
              rgba(0,0,0,0.72) 100%
            )
          `,
        }}
      />

      {/* Top cinematic fade */}
      <div
        className="absolute inset-x-0 top-0 h-44"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)",
        }}
      />

      {/* Bottom cinematic fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-80"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.98), transparent)",
        }}
      />
    </div>,
    document.body
  );
    }
