"use client";

import { useEffect, useRef } from "react";

type MotionState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export default function MangaParallaxBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = backgroundRef.current;

    if (!background) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (reducedMotion.matches) return;

    let isMobile = window.matchMedia("(max-width: 768px)").matches;

    /*
     * ----------------------------------------
     * CAMERA
     * ----------------------------------------
     *
     * x / y = current camera position
     * vx / vy = camera velocity
     *
     * This is intentionally physics-based rather
     * than using a fixed interpolation percentage.
     */
    const current: MotionState = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    };

    const target = {
      x: 0,
      y: 0,
    };

    /*
     * ----------------------------------------
     * DESKTOP SETTINGS
     * ----------------------------------------
     */

    const DESKTOP_MAX_X = 18;
    const DESKTOP_MAX_Y = 12;

    /*
     * ----------------------------------------
     * MOBILE SETTINGS
     * ----------------------------------------
     *
     * Small movement is intentional.
     *
     * Premium parallax should be felt rather
     * than constantly noticed.
     */
    const MOBILE_MAX_Y = 72;

    /*
     * Scroll distance over which the background
     * reaches most of its available movement.
     *
     * We use a smooth curve rather than a hard
     * clamp, so it never suddenly hits a wall.
     */
    const MOBILE_SCROLL_RANGE = 1800;

    let scrollY = window.scrollY;

    /*
     * ----------------------------------------
     * HELPERS
     * ----------------------------------------
     */

    const clamp = (
      value: number,
      min: number,
      max: number
    ) => {
      return Math.max(min, Math.min(max, value));
    };

    /*
     * Smooth bounded curve.
     *
     * Unlike:
     *
     * scrollY * 0.34
     *
     * this never sends the image endlessly toward
     * the bottom of the JPEG.
     *
     * It approaches the maximum gradually.
     */
    const mobileScrollOffset = (scroll: number) => {
      const normalized =
        scroll / MOBILE_SCROLL_RANGE;

      /*
       * tanh gives us a beautiful natural-looking
       * ease toward the maximum without a hard stop.
       */
      const eased = Math.tanh(normalized);

      return eased * MOBILE_MAX_Y;
    };

    /*
     * ----------------------------------------
     * POINTER
     * ----------------------------------------
     */

    const handlePointerMove = (
      event: PointerEvent
    ) => {
      if (isMobile) return;

      if (event.pointerType === "touch") return;

      const normalizedX =
        event.clientX / window.innerWidth - 0.5;

      const normalizedY =
        event.clientY / window.innerHeight - 0.5;

      /*
       * The cursor is the camera.
       *
       * Moving the cursor right makes the artwork
       * subtly drift left, creating depth.
       */
      target.x =
        -normalizedX * DESKTOP_MAX_X;

      target.y =
        -normalizedY * DESKTOP_MAX_Y;
    };

    const handlePointerLeave = () => {
      if (isMobile) return;

      target.x = 0;
      target.y = 0;
    };

    /*
     * ----------------------------------------
     * SCROLL
     * ----------------------------------------
     */

    const handleScroll = () => {
      if (!isMobile) return;

      scrollY = window.scrollY;

      /*
       * Directly map the browser's actual scroll
       * position to the camera target.
       *
       * No velocity limiter.
       */
      target.y = -mobileScrollOffset(scrollY);
    };

    /*
     * ----------------------------------------
     * RESPONSIVE MODE
     * ----------------------------------------
     */

    const handleResize = () => {
      const nextMobile =
        window.matchMedia(
          "(max-width: 768px)"
        ).matches;

      if (nextMobile === isMobile) return;

      isMobile = nextMobile;

      /*
       * Reset the camera when switching modes.
       */
      current.x = 0;
      current.y = 0;
      current.vx = 0;
      current.vy = 0;

      target.x = 0;
      target.y = isMobile
        ? -mobileScrollOffset(window.scrollY)
        : 0;
    };

    /*
     * ----------------------------------------
     * PHYSICS
     * ----------------------------------------
     *
     * This is a critically-damped style spring.
     *
     * The important difference from the old code:
     *
     * OLD:
     *
     * position += difference * fixedAmount
     *
     * NEW:
     *
     * acceleration → velocity → position
     *
     * This gives the camera actual momentum and
     * makes it much less dependent on frame rate.
     */

    let previousTime = performance.now();

    const animate = (now: number) => {
      /*
       * Convert elapsed time into seconds.
       *
       * Clamped so a background tab waking up doesn't
       * cause a gigantic physics jump.
       */
      const dt = Math.min(
        (now - previousTime) / 1000,
        0.032
      );

      previousTime = now;

      /*
       * ----------------------------------------
       * SPRING PARAMETERS
       * ----------------------------------------
       */

      const stiffness = isMobile
        ? 135
        : 150;

      const damping = isMobile
        ? 20
        : 22;

      /*
       * X spring
       */
      const ax =
        (target.x - current.x) * stiffness -
        current.vx * damping;

      /*
       * Y spring
       */
      const ay =
        (target.y - current.y) * stiffness -
        current.vy * damping;

      current.vx += ax * dt;
      current.vy += ay * dt;

      current.x += current.vx * dt;
      current.y += current.vy * dt;

      /*
       * Prevent microscopic floating-point movement
       * once the camera has settled.
       */
      if (
        Math.abs(current.x - target.x) < 0.001 &&
        Math.abs(current.vx) < 0.001
      ) {
        current.x = target.x;
        current.vx = 0;
      }

      if (
        Math.abs(current.y - target.y) < 0.001 &&
        Math.abs(current.vy) < 0.001
      ) {
        current.y = target.y;
        current.vy = 0;
      }

      /*
       * ----------------------------------------
       * RENDER
       * ----------------------------------------
       *
       * translate3d keeps the artwork on the
       * compositor instead of constantly repainting it.
       */
      background.style.transform = `
        translate3d(
          ${current.x.toFixed(3)}px,
          ${current.y.toFixed(3)}px,
          0
        )
        scale(${isMobile ? "1.14" : "1.12"})
      `;

      requestAnimationFrame(animate);
    };

    /*
     * ----------------------------------------
     * EVENTS
     * ----------------------------------------
     */

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      { passive: true }
    );

    window.addEventListener(
      "pointerleave",
      handlePointerLeave
    );

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    window.addEventListener(
      "resize",
      handleResize,
      { passive: true }
    );

    /*
     * Set initial mobile target.
     */
    if (isMobile) {
      target.y =
        -mobileScrollOffset(window.scrollY);
    }

    /*
     * Start the renderer.
     */
    const frame = requestAnimationFrame(
      (time) => {
        previousTime = time;
        requestAnimationFrame(animate);
      }
    );

    /*
     * Cleanup.
     */
    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerleave",
        handlePointerLeave
      );

      window.removeEventListener(
        "scroll",
        handleScroll
      );

      window.removeEventListener(
        "resize",
        handleResize
      );

      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        contain: "paint",
      }}
    >
      {/* =====================================================
          MANGA CAMERA
          ===================================================== */}

      <div
        ref={backgroundRef}
        className="absolute -inset-[14%] will-change-transform"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <img
          src="/ryuflixx-manga-bg.jpeg"
          alt=""
          draggable={false}
          className="block h-full w-full select-none object-cover grayscale"
          style={{
            objectPosition: "center center",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        />
      </div>

      {/* =====================================================
          CINEMATIC DARKNESS
          ===================================================== */}

      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(0,0,0,0.86) 0%,
              rgba(0,0,0,0.42) 27%,
              rgba(0,0,0,0.46) 55%,
              rgba(0,0,0,0.96) 100%
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
              transparent 18%,
              rgba(0,0,0,0.78) 100%
            )
          `,
        }}
      />

      {/* =====================================================
          TOP CINEMATIC FADE
          ===================================================== */}

      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.92), transparent)",
        }}
      />

      {/* =====================================================
          BOTTOM CINEMATIC FADE
          ===================================================== */}

      <div
        className="absolute inset-x-0 bottom-0 h-72"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.98), transparent)",
        }}
      />

      {/* =====================================================
          SUBTLE FILM GRAIN
          ===================================================== */}

      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-soft-light"
        style={{
          backgroundImage: `
            radial-gradient(
              rgba(255,255,255,0.8) 0.6px,
              transparent 0.6px
            )
          `,
          backgroundSize: "7px 7px",
        }}
      />
    </div>
  );
      }
