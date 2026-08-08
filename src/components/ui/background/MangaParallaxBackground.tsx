"use client";

import { useEffect, useRef } from "react";

const MangaParallaxBackground = () => {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const element = backgroundRef.current;
    if (!element) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const update = () => {
      currentX += (targetX - currentX) * 0.055;
      currentY += (targetY - currentY) * 0.055;

      element.style.setProperty("--parallax-x", `${currentX}px`);
      element.style.setProperty("--parallax-y", `${currentY}px`);

      frameRef.current = requestAnimationFrame(update);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;

      targetX = x * -18;
      targetY = y * -12;
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    window.addEventListener("pointerleave", handlePointerLeave);

    frameRef.current = requestAnimationFrame(update);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Manga artwork */}
      <div
        ref={backgroundRef}
        className="absolute -inset-[7%] will-change-transform"
        style={{
          transform:
            "translate3d(var(--parallax-x, 0px), var(--parallax-y, 0px), 0) scale(1.06)",
        }}
      >
        <img
          src="/images/ryuflixx-manga-bg.jpg"
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover object-center grayscale"
        />
      </div>

      {/* Cinematic darkening */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(0,0,0,0.82) 0%,
              rgba(0,0,0,0.48) 25%,
              rgba(0,0,0,0.64) 58%,
              rgba(0,0,0,0.96) 100%
            )
          `,
        }}
      />

      {/* Side vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* Subtle cinematic grain */}
      <div
        className="absolute inset-0 opacity-[0.055] mix-blend-soft-light"
        style={{
          backgroundImage: `
            radial-gradient(rgba(255,255,255,0.8) 0.6px, transparent 0.6px),
            radial-gradient(rgba(0,0,0,0.8) 0.6px, transparent 0.6px)
          `,
          backgroundPosition: "0 0, 4px 4px",
          backgroundSize: "8px 8px",
        }}
      />

      {/* Final cinematic wash */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
};

export default MangaParallaxBackground;
