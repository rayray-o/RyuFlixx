"use client";

import { useEffect, useRef } from "react";
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

    a.currentTime = 0;
    b.currentTime = 0;

    a.style.opacity = "1";
    b.style.opacity = "0";

    a.play().catch(() => {});

    const startNext = async () => {
      if (destroyed || transitioning.current) return;

      const current =
        active.current === "a" ? a : b;

      const next =
        active.current === "a" ? b : a;

      /*
       * Don't let multiple timeupdate events trigger
       * multiple transitions.
       */
      transitioning.current = true;

      /*
       * Prepare the next copy at the beginning.
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
       * Crossfade.
       *
       * The old video is still playing underneath while
       * the new copy fades in.
       */
      next.style.transition =
        `opacity ${CROSSFADE_TIME}s linear`;

      current.style.transition =
        `opacity ${CROSSFADE_TIME}s linear`;

      next.style.opacity = "1";
      current.style.opacity = "0";

      /*
       * After the crossfade, reset the old video so it is
       * ready for the next cycle.
       */
      window.setTimeout(() => {
        if (destroyed) return;

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

    a.addEventListener(
      "timeupdate",
      handleTimeUpdate
    );

    b.addEventListener(
      "timeupdate",
      handleTimeUpdate
    );

    /*
     * If the browser somehow reaches the exact end
     * before timeupdate catches the transition, restart
     * the inactive copy immediately.
     */
    const handleEnded = () => {
      if (!transitioning.current) {
        startNext();
      }
    };

    a.addEventListener(
      "ended",
      handleEnded
    );

    b.addEventListener(
      "ended",
      handleEnded
    );

    /*
     * Resume playback when the tab becomes visible.
     */
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const current =
        active.current === "a" ? a : b;

      current.play().catch(() => {});
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      destroyed = true;

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
        handleVisibility
      );
    };
  }, []);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{
        /*
         * This layer itself never participates in page
         * scrolling.
         */
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
        /*
         * Explicitly lock this element to the viewport.
         */
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100dvh",

        /*
         * Keep it completely independent from the page
         * content's scrolling/compositing.
         */
        transform: "translate3d(0, 0, 0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        isolation: "isolate",
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

      {/* =====================================================
          VIGNETTE
          ===================================================== */}

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

      {/* =====================================================
          TOP FADE
          ===================================================== */}

      <div
        className="absolute inset-x-0 top-0 h-44"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)",
        }}
      />

      {/* =====================================================
          BOTTOM FADE
          ===================================================== */}

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
