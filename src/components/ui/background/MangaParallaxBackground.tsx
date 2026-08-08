"use client";

import { useEffect, useRef } from "react";

export default function MangaParallaxBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = backgroundRef.current;
    if (!background) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    let animationFrame = 0;

    // -----------------------------
    // DESKTOP: cursor parallax
    // -----------------------------

    let mouseTargetX = 0;
    let mouseTargetY = 0;

    let mouseX = 0;
    let mouseY = 0;

    // -----------------------------
    // MOBILE: direct scroll parallax
    // -----------------------------

    let scrollY = window.scrollY;

    /*
     * The background follows the actual scroll position directly.
     *
     * 0.34 means:
     * 100px page movement ≈ 34px background movement.
     */
    const scrollStrength = 0.34;

    /*
     * Extra image size prevents the edges from becoming visible.
     */
    const scale = isMobile ? 1.18 : 1.12;

    /*
     * How much vertical movement is available before
     * we rebase the visual position.
     */
    const mobileRange = 260;

    /*
     * Smooth desktop cursor movement.
     */
    const animate = () => {
      if (isMobile) {
        /*
         * MOBILE
         *
         * Directly derive the position from the real scroll
         * position. No velocity limiter. No chasing a target.
         */
        const rawOffset = scrollY * scrollStrength;

        /*
         * Rebase the position periodically.
         *
         * This keeps the visual movement inside a finite range
         * even if the user scrolls thousands of pixels.
         */
        const cycle = Math.floor(rawOffset / mobileRange);

        const localOffset = rawOffset - cycle * mobileRange;

        background.style.transform = `
          translate3d(0, ${-localOffset}px, 0)
          scale(${scale})
        `;
      } else {
        /*
         * DESKTOP
         *
         * Smooth cursor-following parallax.
         */
        mouseX += (mouseTargetX - mouseX) * 0.075;
        mouseY += (mouseTargetY - mouseY) * 0.075;

        background.style.transform = `
          translate3d(${mouseX}px, ${mouseY}px, 0)
          scale(${scale})
        `;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    const handleScroll = () => {
      if (!isMobile) return;

      /*
       * Read the real browser scroll position.
       * No artificial speed cap.
       */
      scrollY = window.scrollY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (isMobile || event.pointerType === "touch") return;

      const normalizedX = event.clientX / window.innerWidth - 0.5;
      const normalizedY = event.clientY / window.innerHeight - 0.5;

      mouseTargetX = normalizedX * -22;
      mouseTargetY = normalizedY * -14;
    };

    const handlePointerLeave = () => {
      mouseTargetX = 0;
      mouseTargetY = 0;
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    window.addEventListener("pointerleave", handlePointerLeave);

    animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);

      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
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

      {/* Cinematic darkness */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(0,0,0,0.84) 0%,
              rgba(0,0,0,0.38) 28%,
              rgba(0,0,0,0.46) 55%,
              rgba(0,0,0,0.95) 100%
            )
          `,
        }}
      />

      {/* Cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 15%, rgba(0,0,0,0.78) 100%)",
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
        className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
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
