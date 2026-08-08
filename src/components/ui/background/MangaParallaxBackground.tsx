"use client";

import { useEffect, useRef } from "react";

export default function MangaParallaxBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = backgroundRef.current;
    if (!background) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (prefersReducedMotion.matches) return;

    let targetY = 0;
    let currentY = 0;

    let targetX = 0;
    let currentX = 0;

    let animationFrame = 0;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    /*
     * THIS is the important part.
     *
     * The background now moves a noticeable percentage
     * of the page's scroll distance.
     */
    const scrollStrength = isMobile ? 0.34 : 0.24;

    const maxMovement = isMobile ? 180 : 240;

    const handleScroll = () => {
      targetY = -window.scrollY * scrollStrength;

      /*
       * Don't let the background travel forever.
       */
      targetY = Math.max(-maxMovement, Math.min(0, targetY));
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (isMobile || event.pointerType === "touch") return;

      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;

      targetX = x * -24;
      targetY += y * -14;
    };

    const handlePointerLeave = () => {
      targetX = 0;
    };

    const animate = () => {
      /*
       * Much faster than the previous version.
       *
       * This means the background visibly follows
       * the scroll instead of waiting until scrolling ends.
       */
      currentY += (targetY - currentY) * 0.22;
      currentX += (targetX - currentX) * 0.12;

      background.style.transform = `
        translate3d(${currentX}px, ${currentY}px, 0)
        scale(1.12)
      `;

      animationFrame = requestAnimationFrame(animate);
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    window.addEventListener("pointerleave", handlePointerLeave);

    handleScroll();

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

      {/* Main cinematic darkness */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(0,0,0,0.82) 0%,
              rgba(0,0,0,0.38) 30%,
              rgba(0,0,0,0.48) 58%,
              rgba(0,0,0,0.94) 100%
            )
          `,
        }}
      />

      {/* Vignette */}
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
            "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)",
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

      {/* Subtle grain */}
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
