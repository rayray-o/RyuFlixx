"use client";

import { useEffect, useRef } from "react";

export default function MangaParallaxBackground() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const mountainRef = useRef<HTMLDivElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const base = baseRef.current;
    const sky = skyRef.current;
    const mountain = mountainRef.current;
    const foreground = foregroundRef.current;

    if (!scene || !base || !sky || !mountain || !foreground) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return;

    let animationFrame = 0;

    let targetScroll = window.scrollY;
    let smoothScroll = window.scrollY;

    let targetX = 0;
    let targetY = 0;

    let smoothX = 0;
    let smoothY = 0;

    let lastScroll = window.scrollY;
    let scrollVelocity = 0;
    let smoothVelocity = 0;

    const mobile = window.matchMedia("(max-width: 768px)").matches;

    /*
     * Mobile intentionally uses smaller movement.
     * Large parallax on a phone becomes distracting very quickly.
     */
    const settings = mobile
      ? {
          scroll: 0.075,
          mouse: 5,
          maxScroll: 75,
          maxVelocity: 18,
        }
      : {
          scroll: 0.13,
          mouse: 15,
          maxScroll: 135,
          maxVelocity: 28,
        };

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const animate = () => {
      /*
       * Smooth scrolling position.
       */
      smoothScroll += (targetScroll - smoothScroll) * 0.075;

      /*
       * Smooth pointer movement.
       */
      smoothX += (targetX - smoothX) * 0.055;
      smoothY += (targetY - smoothY) * 0.055;

      /*
       * Scroll velocity creates a little extra "life".
       */
      scrollVelocity = targetScroll - lastScroll;
      lastScroll = targetScroll;

      smoothVelocity += (scrollVelocity - smoothVelocity) * 0.08;

      const velocityBoost = clamp(
        smoothVelocity,
        -settings.maxVelocity,
        settings.maxVelocity
      );

      /*
       * Main vertical parallax.
       */
      const scrollOffset = clamp(
        smoothScroll * settings.scroll,
        -settings.maxScroll,
        settings.maxScroll
      );

      /*
       * Mouse / pointer movement.
       */
      const pointerX = smoothX * settings.mouse;
      const pointerY = smoothY * settings.mouse * 0.65;

      /*
       * Overall camera movement.
       */
      scene.style.transform = `
        translate3d(${pointerX * 0.25}px, ${pointerY * 0.25}px, 0)
        scale(1.075)
      `;

      /*
       * DEPTH LAYER 1 — entire panel.
       */
      base.style.transform = `
        translate3d(
          ${pointerX * 0.55}px,
          ${pointerY * 0.55 - scrollOffset * 0.55}px,
          0
        )
        scale(1.02)
      `;

      /*
       * DEPTH LAYER 2 — sky.
       * Moves slowly, making it feel distant.
       */
      sky.style.transform = `
        translate3d(
          ${pointerX * 0.35}px,
          ${pointerY * 0.35 - scrollOffset * 0.32}px,
          0
        )
        scale(1.045)
      `;

      /*
       * DEPTH LAYER 3 — mountains.
       */
      mountain.style.transform = `
        translate3d(
          ${pointerX * 0.75}px,
          ${pointerY * 0.75 - scrollOffset * 0.78}px,
          0
        )
        scale(1.065)
      `;

      /*
       * DEPTH LAYER 4 — foreground.
       * This moves the most, creating the strongest depth cue.
       */
      foreground.style.transform = `
        translate3d(
          ${pointerX * 1.05}px,
          ${
            pointerY * 1.05 -
            scrollOffset * 1.16 -
            velocityBoost * 0.45
          }px,
          0
        )
        scale(1.09)
      `;

      animationFrame = requestAnimationFrame(animate);
    };

    const handleScroll = () => {
      targetScroll = window.scrollY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (mobile || event.pointerType === "touch") return;

      const normalizedX = event.clientX / window.innerWidth - 0.5;
      const normalizedY = event.clientY / window.innerHeight - 0.5;

      targetX = normalizedX * -2;
      targetY = normalizedY * -2;
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    /*
     * Touch devices get a subtle movement from touch position
     * rather than relying on a mouse.
     */
    const handleTouchMove = (event: TouchEvent) => {
      if (!mobile || !event.touches[0]) return;

      const touch = event.touches[0];

      const normalizedX = touch.clientX / window.innerWidth - 0.5;
      const normalizedY = touch.clientY / window.innerHeight - 0.5;

      targetX = normalizedX * 0.8;
      targetY = normalizedY * 0.5;
    };

    const handleTouchEnd = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    window.addEventListener("pointerleave", handlePointerLeave);

    window.addEventListener("touchmove", handleTouchMove, {
      passive: true,
    });

    window.addEventListener("touchend", handleTouchEnd);

    animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);

      cancelAnimationFrame(animationFrame);
    };
  }, []);

  const image = "/ryuflixx-manga-bg.jpeg";

  return (
    <div
      ref={sceneRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* =========================================================
          BASE PANEL
          ========================================================= */}
      <div
        ref={baseRef}
        className="absolute -inset-[10%] will-change-transform"
      >
        <img
          src={image}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover grayscale"
          style={{
            objectPosition: "center center",
          }}
        />
      </div>

      {/* =========================================================
          DISTANT SKY
          ========================================================= */}
      <div
        ref={skyRef}
        className="absolute -inset-[10%] overflow-hidden will-change-transform"
        style={{
          clipPath: "inset(0 0 47% 0)",
          opacity: 0.22,
          mixBlendMode: "normal",
        }}
      >
        <img
          src={image}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover grayscale"
          style={{
            objectPosition: "center center",
          }}
        />
      </div>

      {/* =========================================================
          MOUNTAINS / MIDGROUND
          ========================================================= */}
      <div
        ref={mountainRef}
        className="absolute -inset-[10%] overflow-hidden will-change-transform"
        style={{
          clipPath: "inset(32% 0 27% 0)",
          opacity: 0.16,
        }}
      >
        <img
          src={image}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover grayscale"
          style={{
            objectPosition: "center center",
          }}
        />
      </div>

      {/* =========================================================
          FOREGROUND
          ========================================================= */}
      <div
        ref={foregroundRef}
        className="absolute -inset-[10%] overflow-hidden will-change-transform"
        style={{
          clipPath: "inset(58% 0 0 0)",
          opacity: 0.14,
        }}
      >
        <img
          src={image}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover grayscale"
          style={{
            objectPosition: "center center",
          }}
        />
      </div>

      {/* =========================================================
          CINEMATIC CONTRAST
          ========================================================= */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(0,0,0,0.86) 0%,
              rgba(0,0,0,0.48) 24%,
              rgba(0,0,0,0.38) 48%,
              rgba(0,0,0,0.64) 72%,
              rgba(0,0,0,0.96) 100%
            )
          `,
        }}
      />

      {/* =========================================================
          SIDE VIGNETTE
          ========================================================= */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse at center,
              transparent 15%,
              rgba(0,0,0,0.18) 48%,
              rgba(0,0,0,0.82) 100%
            )
          `,
        }}
      />

      {/* =========================================================
          TOP FADE — protects navbar
          ========================================================= */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.92), transparent)",
        }}
      />

      {/* =========================================================
          BOTTOM FADE — protects movie cards / bottom navigation
          ========================================================= */}
      <div
        className="absolute inset-x-0 bottom-0 h-64"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.98), transparent)",
        }}
      />

      {/* =========================================================
          SUBTLE GRAIN
          ========================================================= */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
        style={{
          backgroundImage: `
            radial-gradient(
              rgba(255,255,255,0.8) 0.6px,
              transparent 0.6px
            ),
            radial-gradient(
              rgba(0,0,0,0.8) 0.6px,
              transparent 0.6px
            )
          `,
          backgroundPosition: "0 0, 4px 4px",
          backgroundSize: "8px 8px",
        }}
      />
    </div>
  );
    }
