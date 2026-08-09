"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CROSSFADE_TIME = 0.7;

function VideoPair({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);

  const activeVideo = useRef<"a" | "b">("a");
  const transitioning = useRef(false);
  const transitionTimer = useRef<number | null>(null);

  useEffect(() => {
    const a = videoA.current;
    const b = videoB.current;

    if (!a || !b) return;

    let disposed = false;

    /*
     * -------------------------------------------------------
     * INITIAL STATE
     * -------------------------------------------------------
     */

    a.currentTime = 0;
    b.currentTime = 0;

    a.style.opacity = "1";
    b.style.opacity = "0";

    a.style.transition = "none";
    b.style.transition = "none";

    /*
     * -------------------------------------------------------
     * PLAYBACK
     * -------------------------------------------------------
     */

    const playActiveVideo = () => {
      const active =
        activeVideo.current === "a" ? a : b;

      active.play().catch(() => {});
    };

    playActiveVideo();

    /*
     * -------------------------------------------------------
     * SEAMLESS CROSSFADE LOOP
     * -------------------------------------------------------
     */

    const crossfadeToNext = async () => {
      if (disposed || transitioning.current) {
        return;
      }

      const current =
        activeVideo.current === "a" ? a : b;

      const next =
        activeVideo.current === "a" ? b : a;

      transitioning.current = true;

      /*
       * Prepare the next copy at frame 0.
       */
      next.pause();
      next.currentTime = 0;

      try {
        await next.play();
      } catch {
        transitioning.current = false;
        return;
      }

      /*
       * Fade the new copy in over the old copy.
       */
      next.style.transition =
        `opacity ${CROSSFADE_TIME}s linear`;

      current.style.transition =
        `opacity ${CROSSFADE_TIME}s linear`;

      next.style.opacity = "1";
      current.style.opacity = "0";

      transitionTimer.current =
        window.setTimeout(() => {
          if (disposed) return;

          /*
           * Reset the old copy while it is invisible.
           */
          current.pause();
          current.currentTime = 0;

          activeVideo.current =
            activeVideo.current === "a"
              ? "b"
              : "a";

          transitioning.current = false;
        }, CROSSFADE_TIME * 1000);
    };

    /*
     * Start the crossfade slightly before the end.
     */
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
        crossfadeToNext();
      }
    };

    /*
     * Emergency fallback in case the browser reaches
     * the end before timeupdate catches it.
     */
    const handleEnded = () => {
      crossfadeToNext();
    };

    /*
     * Resume only when the page becomes visible again.
     */
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible"
      ) {
        playActiveVideo();
      }
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

    /*
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
     */

    return () => {
      disposed = true;

      if (transitionTimer.current !== null) {
        window.clearTimeout(
          transitionTimer.current
        );
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
      className={`absolute left-0 top-0 h-full w-full ${className ?? ""}`}
      style={{
        overflow: "hidden",
      }}
    >
      {/* Video A */}
      <video
        ref={videoA}
        src={src}
        muted
        playsInline
        preload="auto"
        className="absolute left-0 top-0 h-full w-full object-cover"
        style={{
          opacity: 1,
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      />

      {/* Video B */}
      <video
        ref={videoB}
        src={src}
        muted
        playsInline
        preload="auto"
        className="absolute left-0 top-0 h-full w-full object-cover"
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

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 overflow-hidden bg-black"
      style={{
        /*
         * ===================================================
         * ABSOLUTELY FIXED VIEWPORT LOCK
         * ===================================================
         *
         * No transform.
         * No scale.
         * No scroll calculations.
         * No dynamic viewport height.
         */

        position: "fixed",

        top: 0,
        left: 0,

        width: "100vw",

        /*
         * svh is deliberately used instead of dvh.
         *
         * svh stays stable when the mobile browser's
         * address/navigation bars expand or collapse.
         */
        height: "100svh",

        maxHeight: "100svh",

        /*
         * Explicitly prevent any transform-based movement.
         */
        transform: "none",

        /*
         * Keep the layer completely independent.
         */
        margin: 0,
        padding: 0,

        /*
         * Don't let this element become a new transformed
         * containing block for anything else.
         */
        isolation: "isolate",

        /*
         * Don't participate in pointer interaction.
         */
        pointerEvents: "none",

        /*
         * Prevent the browser from trying to optimize this
         * as a scroll-linked element.
         */
        touchAction: "none",

        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {/* =====================================================
          DESKTOP WALLPAPER
          ===================================================== */}

      <VideoPair
        src="/Desktop-RyuFlix.mp4"
        className="hidden md:block"
      />

      {/* =====================================================
          MOBILE WALLPAPER
          ===================================================== */}

      <VideoPair
        src="/Phone-RyuFlix.mp4"
        className="block md:hidden"
      />

      {/* =====================================================
          CINEMATIC DARKNESS
          ===================================================== */}

      <div
        className="absolute left-0 top-0 h-full w-full"
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

      {/* =====================================================
          VIGNETTE
          ===================================================== */}

      <div
        className="absolute left-0 top-0 h-full w-full"
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

      {/* =====================================================
          TOP FADE
          ===================================================== */}

      <div
        className="absolute left-0 top-0 h-44 w-full"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)",
        }}
      />

      {/* =====================================================
          BOTTOM FADE
          ===================================================== */}

      <div
        className="absolute bottom-0 left-0 h-80 w-full"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.98), transparent)",
        }}
      />
    </div>,
    document.body
  );
}
