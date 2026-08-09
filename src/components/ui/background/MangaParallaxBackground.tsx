"use client";

import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
};

export default function MangaParallaxBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = backgroundRef.current;

    if (!background) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (reducedMotionQuery.matches) {
      return;
    }

    let mobile = window.matchMedia(
      "(max-width: 768px)"
    ).matches;

    /*
     * -------------------------------------------------------
     * CAMERA STATE
     * -------------------------------------------------------
     */

    const current: Point = {
      x: 0,
      y: 0,
    };

    const target: Point = {
      x: 0,
      y: 0,
    };

    /*
     * -------------------------------------------------------
     * VELOCITY
     * -------------------------------------------------------
     *
     * Used only on mobile.
     *
     * The background reacts to how the user is moving
     * through the page rather than accumulating thousands
     * of pixels of movement.
     */

    let scrollVelocity = 0;
    let lastScrollY = window.scrollY;
    let lastScrollTime = performance.now();

    /*
     * -------------------------------------------------------
     * DESKTOP CAMERA
     * -------------------------------------------------------
     */

    const DESKTOP_X = 14;
    const DESKTOP_Y = 9;

    /*
     * -------------------------------------------------------
     * MOBILE CAMERA
     * -------------------------------------------------------
     *
     * Extremely small on purpose.
     *
     * This is depth, not a moving wallpaper.
     */

    const MOBILE_MAX = 22;

    /*
     * How strongly a scroll burst affects the camera.
     */
    const MOBILE_VELOCITY_RESPONSE = 0.075;

    /*
     * -------------------------------------------------------
     * POINTER
     * -------------------------------------------------------
     */

    const handlePointerMove = (event: PointerEvent) => {
      if (mobile) return;
      if (event.pointerType === "touch") return;

      const x =
        event.clientX / window.innerWidth - 0.5;

      const y =
        event.clientY / window.innerHeight - 0.5;

      target.x = -x * DESKTOP_X;
      target.y = -y * DESKTOP_Y;
    };

    const handlePointerLeave = () => {
      if (mobile) return;

      target.x = 0;
      target.y = 0;
    };

    /*
     * -------------------------------------------------------
     * MOBILE SCROLL
     * -------------------------------------------------------
     */

    const handleScroll = () => {
      if (!mobile) return;

      const now = performance.now();
      const newScrollY = window.scrollY;

      const elapsed = Math.max(
        now - lastScrollTime,
        1
      );

      const delta = newScrollY - lastScrollY;

      /*
       * Pixels per millisecond.
       *
       * There is intentionally no artificial maximum
       * scroll speed. Fast swipes produce a stronger
       * immediate camera response.
       */
      const instantaneousVelocity =
        delta / elapsed;

      /*
       * Smooth the measured velocity slightly.
       *
       * This removes noisy phone scroll events without
       * making the background lag behind the gesture.
       */
      scrollVelocity =
        scrollVelocity * 0.35 +
        instantaneousVelocity * 0.65;

      /*
       * Camera moves opposite the page direction.
       */
      target.y = Math.max(
        -MOBILE_MAX,
        Math.min(
          MOBILE_MAX,
          -scrollVelocity *
            MOBILE_VELOCITY_RESPONSE *
            100
        )
      );

      /*
       * Horizontal movement is not generated from scroll.
       */
      target.x = 0;

      lastScrollY = newScrollY;
      lastScrollTime = now;
    };

    /*
     * -------------------------------------------------------
     * RESIZE
     * -------------------------------------------------------
     */

    const handleResize = () => {
      const nextMobile =
        window.matchMedia(
          "(max-width: 768px)"
        ).matches;

      if (nextMobile === mobile) return;

      mobile = nextMobile;

      current.x = 0;
      current.y = 0;

      target.x = 0;
      target.y = 0;

      scrollVelocity = 0;

      lastScrollY = window.scrollY;
      lastScrollTime = performance.now();
    };

    /*
     * -------------------------------------------------------
     * RENDER LOOP
     * -------------------------------------------------------
     *
     * This is a critically damped camera.
     *
     * Unlike the old:
     *
     * current += difference * 0.075
     *
     * this uses velocity + damping, which makes the
     * response independent of the display refresh rate.
     */

    let raf = 0;
    let previousTime = performance.now();

    const animate = (now: number) => {
      const deltaTime = Math.min(
        (now - previousTime) / 1000,
        0.033
      );

      previousTime = now;

      /*
       * Mobile camera slowly returns to neutral once
       * the scroll burst ends.
       *
       * Desktop follows the cursor target.
       */
      const stiffness = mobile ? 115 : 145;
      const damping = mobile ? 18 : 21;

      /*
       * X axis.
       */
      const xDifference =
        target.x - current.x;

      /*
       * Y axis.
       */
      const yDifference =
        target.y - current.y;

      /*
       * We keep velocity internally inside the closure
       * rather than relying on browser scroll animation.
       */

      cameraVelocity.x +=
        xDifference *
        stiffness *
        deltaTime;

      cameraVelocity.y +=
        yDifference *
        stiffness *
        deltaTime;

      cameraVelocity.x *= Math.exp(
        -damping * deltaTime
      );

      cameraVelocity.y *= Math.exp(
        -damping * deltaTime
      );

      current.x +=
        cameraVelocity.x * deltaTime;

      current.y +=
        cameraVelocity.y * deltaTime;

      /*
       * Once extremely close, snap to the target.
       * This prevents microscopic perpetual movement.
       */
      if (
        Math.abs(target.x - current.x) < 0.001 &&
        Math.abs(cameraVelocity.x) < 0.001
      ) {
        current.x = target.x;
        cameraVelocity.x = 0;
      }

      if (
        Math.abs(target.y - current.y) < 0.001 &&
        Math.abs(cameraVelocity.y) < 0.001
      ) {
        current.y = target.y;
        cameraVelocity.y = 0;
      }

      /*
       * GPU-composited transform.
       *
       * Extra scale gives us enough image overscan that
       * the camera can move without exposing edges.
       */
      background.style.transform = `
        translate3d(
          ${current.x.toFixed(3)}px,
          ${current.y.toFixed(3)}px,
          0
        )
        scale(${mobile ? "1.14" : "1.12"})
      `;

      raf = requestAnimationFrame(animate);
    };

    /*
     * Camera velocity lives here so it survives every
     * animation frame without causing React renders.
     */
    const cameraVelocity: Point = {
      x: 0,
      y: 0,
    };

    /*
     * -------------------------------------------------------
     * EVENTS
     * -------------------------------------------------------
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
     * Start.
     */
    raf = requestAnimationFrame((time) => {
      previousTime = time;
      raf = requestAnimationFrame(animate);
    });

    /*
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
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

      cancelAnimationFrame(raf);
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
      <div
        ref={backgroundRef}
        className="absolute -inset-[14%] will-change-transform"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "translate3d(0, 0, 0) scale(1.14)",
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

      {/* Cinematic darkness */}
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

      {/* Vignette */}
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

      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.92), transparent)",
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-72"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.98), transparent)",
        }}
      />

      {/* Subtle film grain */}
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
