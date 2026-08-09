"use client";

import { useEffect, useRef } from "react";

export default function MangaParallaxBackground() {
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const desktopVideo = desktopVideoRef.current;
    const mobileVideo = mobileVideoRef.current;

    if (!desktopVideo || !mobileVideo) return;

    const startVideos = () => {
      desktopVideo.play().catch(() => {});
      mobileVideo.play().catch(() => {});
    };

    startVideos();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startVideos();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
    >
      {/* Desktop animated wallpaper */}
      <video
        ref={desktopVideoRef}
        className="
          absolute
          inset-0
          hidden
          h-full
          w-full
          object-cover
          md:block
        "
        src="/Desktop-RyuFlix.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

      {/* Mobile animated wallpaper */}
      <video
        ref={mobileVideoRef}
        className="
          absolute
          inset-0
          block
          h-full
          w-full
          object-cover
          md:hidden
        "
        src="/Phone-RyuFlix.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
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
    </div>
  );
        }
