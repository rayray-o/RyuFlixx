"use client";

import { useEffect, useRef, useState } from "react";

const CROSSFADE_TIME = 0.7;

function VideoPair({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);

  const activeVideo = useRef<"a" | "b">("a");
  const transitioning = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const a = videoA.current;
    const b = videoB.current;

    if (!a || !b) return;

    let destroyed = false;

    a.currentTime = 0;
    b.currentTime = 0;

    a.style.opacity = "1";
    b.style.opacity = "0";

    const playActive = () => {
      const active =
        activeVideo.current === "a" ? a : b;

      active.play().catch(() => {});
    };

    playActive();

    const crossfade = async () => {
      if (destroyed || transitioning.current) {
        return;
      }

      const current =
        activeVideo.current === "a" ? a : b;

      const next =
        activeVideo.current === "a" ? b : a;

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

      timer.current = window.setTimeout(() => {
        if (destroyed) return;

        current.pause();
        current.currentTime = 0;

        activeVideo.current =
          activeVideo.current === "a" ? "b" : "a";

        transitioning.current = false;
      }, CROSSFADE_TIME * 1000);
    };

    const handleTimeUpdate = (event: Event) => {
      const video =
        event.currentTarget as HTMLVideoElement;

      if (!Number.isFinite(video.duration)) {
        return;
      }

      const remaining =
        video.duration - video.currentTime;

      if (
        remaining <= CROSSFADE_TIME &&
        remaining > 0
      ) {
        crossfade();
      }
    };

    const handleEnded = () => {
      crossfade();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        playActive();
      }
    };

    a.addEventListener("timeupdate", handleTimeUpdate);
    b.addEventListener("timeupdate", handleTimeUpdate);

    a.addEventListener("ended", handleEnded);
    b.addEventListener("ended", handleEnded);

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      destroyed = true;

      if (timer.current !== null) {
        window.clearTimeout(timer.current);
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

      a.removeEventListener("ended", handleEnded);
      b.removeEventListener("ended", handleEnded);

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, []);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
    >
      <video
        ref={videoA}
        src={src}
        autoPlay
        muted
        loop={false}
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: 1,
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      />

      <video
        ref={videoB}
        src={src}
        autoPlay={false}
        muted
        loop={false}
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: 0,
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
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

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,

        width: "100vw",
        height: "100vh",

        margin: 0,
        padding: 0,

        transform: "none",
        scale: "none",

        overflow: "hidden",
        pointerEvents: "none",

        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {/* Desktop */}
      <VideoPair
        src="/Desktop-RyuFlix.mp4"
        className="hidden md:block"
      />

      {/* Mobile */}
      <VideoPair
        src="/Phone-RyuFlix.mp4"
        className="block md:hidden"
      />

      {/* Main darkness */}
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

      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 h-44"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)",
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-80"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.98), transparent)",
        }}
      />
    </div>
  );
            }
