"use client";

import { useEffect, useRef } from "react";

export default function MangaParallaxBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = backgroundRef.current;
    if (!background) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) return;

    const isMobile = window.matchMedia(
      "(max-width: 768px)"
    ).matches;

    /*
     * MOBILE
     *
     * The mobile parallax is handled by CSS scroll-driven
     * animation instead of JavaScript.
     *
     * This is considerably smoother because the browser can
     * handle the animation on the compositor.
     */
    if (isMobile) {
      background.classList.add("manga-mobile-scroll");

      return () => {
        background.classList.remove("manga-mobile-scroll");
      };
    }

    /*
     * DESKTOP
     *
     * Desktop uses the cursor as a virtual camera.
     */

    let targetX = 0;
    let targetY = 0;

    let currentX = 0;
    let currentY = 0;

    let animationFrame = 0;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      /*
       * Convert cursor position into a range around zero.
       *
       * Center of screen:
       *     0, 0
       *
       * Left:
       *     positive X
       *
       * Right:
       *     negative X
       */

      const x =
        event.clientX / window.innerWidth - 0.5;

      const y =
        event.clientY / window.innerHeight - 0.5;

      /*
       * Small movement = premium.
       *
       * We deliberately DON'T make the background fly
       * around the screen.
       */
      targetX = x * -18;
      targetY = y * -12;
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const animate = () => {
      /*
       * Spring-like interpolation.
       *
       * This gives the cursor movement that smooth,
       * floating live-wallpaper feeling.
       */
      currentX +=
        (targetX - currentX) * 0.075;

      currentY +=
        (targetY - currentY) * 0.075;

      background.style.transform = `
        translate3d(
          ${currentX}px,
          ${currentY}px,
          0
        )
        scale(1.12)
      `;

      animationFrame =
        requestAnimationFrame(animate);
    };

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      { passive: true }
    );

    window.addEventListener(
      "pointerleave",
      handlePointerLeave
    );

    animationFrame =
      requestAnimationFrame(animate);

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerleave",
        handlePointerLeave
      );

      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* =====================================================
          MANGA IMAGE
          ===================================================== */}

      <div
        ref={backgroundRef}
        className="absolute -inset-[12%] will-change-transform"
      >
        <img
          src="/ryuflixx-manga-bg.jpeg"
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover grayscale"
          style={{
            objectPosition: "center center",
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
          CINEMATIC VIGNETTE
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
          TOP FADE
          ===================================================== */}

      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.92), transparent)",
        }}
      />

      {/* =====================================================
          BOTTOM FADE
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
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
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

      {/* =====================================================
          MOBILE SCROLL PARALLAX
          ===================================================== */}

      <style jsx>{`
        .manga-mobile-scroll {
          animation-name: mangaScrollParallax;
          animation-duration: 1ms;
          animation-timing-function: linear;
          animation-fill-mode: both;

          /*
           * Tell modern browsers that the animation
           * is controlled by document scrolling.
           */
          animation-timeline: scroll(root block);

          /*
           * Make sure the browser treats this as a
           * compositor-friendly transform.
           */
          will-change: transform;
        }

        @keyframes mangaScrollParallax {
          from {
            transform:
              translate3d(0, 0, 0)
              scale(1.12);
          }

          to {
            transform:
              translate3d(0, -8vh, 0)
              scale(1.12);
          }
        }

        /*
         * Fallback for browsers that don't support
         * scroll-driven animations.
         *
         * The background simply stays still rather
         * than using the old jittery JavaScript system.
         */
        @supports not (
          animation-timeline: scroll(root block)
        ) {
          .manga-mobile-scroll {
            animation: none;
            transform: scale(1.12);
          }
        }
      `}</style>
    </div>
  );
    }
