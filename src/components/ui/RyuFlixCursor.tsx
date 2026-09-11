"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Point = {
  x: number;
  y: number;
};

const HIDDEN: Point = {
  x: -100,
  y: -100,
};

export default function RyuFlixCursor() {
  const pathname = usePathname();

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const target = useRef<Point>({ ...HIDDEN });
  const dot = useRef<Point>({ ...HIDDEN });
  const ring = useRef<Point>({ ...HIDDEN });

  const visible = useRef(false);
  const lastInteraction = useRef(0);
  const frame = useRef<number | null>(null);
  const lastFrameTime = useRef<number | null>(null);

  const touchStart = useRef<Point>({ x: 0, y: 0 });
  const touchMoved = useRef(false);

  const isTv =
    pathname.startsWith("/tv") ||
    pathname.includes("/tv/");

  const accent = isTv ? "#FFB51B" : "#1683FF";

  useEffect(() => {
    const dotElement = dotRef.current;
    const ringElement = ringRef.current;

    if (!dotElement || !ringElement) {
      return;
    }

    const coarse = window.matchMedia(
      "(pointer: coarse)",
    ).matches;

    /*
     * IMPORTANT:
     *
     * There is deliberately NO velocity here.
     * No spring.
     * No acceleration.
     * No damping.
     * No oscillation.
     *
     * Both objects use a first-order exponential
     * follower. That means they can approach the
     * target asymptotically, but they cannot overshoot
     * it or wobble around it.
     */

    const follow = (
      current: number,
      destination: number,
      speed: number,
      dt: number,
    ) => {
      const alpha = 1 - Math.exp(-speed * dt);

      return current + (destination - current) * alpha;
    };

    const render = (now: number) => {
      const previous = lastFrameTime.current;

      let dt = previous === null
        ? 1 / 60
        : (now - previous) / 1000;

      lastFrameTime.current = now;

      /*
       * Prevent a tab switch / frame stall from producing
       * a giant movement jump.
       */
      dt = Math.min(Math.max(dt, 0), 0.033);

      /*
       * FAST DOT
       *
       * This reaches the target quickly but never
       * overshoots it.
       */
      dot.current.x = follow(
        dot.current.x,
        target.current.x,
        24,
        dt,
      );

      dot.current.y = follow(
        dot.current.y,
        target.current.y,
        24,
        dt,
      );

      /*
       * SLOWER RING
       *
       * Same target, completely independent position.
       * Because the response is slower, it naturally
       * trails behind the dot without any spring physics.
       */
      ring.current.x = follow(
        ring.current.x,
        target.current.x,
        7,
        dt,
      );

      ring.current.y = follow(
        ring.current.y,
        target.current.y,
        7,
        dt,
      );

      dotElement.style.transform =
        `translate3d(${dot.current.x}px, ${dot.current.y}px, 0) translate(-50%, -50%)`;

      ringElement.style.transform =
        `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;

      if (visible.current) {
        const elapsed =
          now - lastInteraction.current;

        /*
         * Stay visible.
         * Fade only after being stationary for a while.
         */
        if (elapsed < 2800) {
          dotElement.style.opacity = "1";
          ringElement.style.opacity = "0.68";
        } else if (elapsed < 3600) {
          const progress =
            (elapsed - 2800) / 800;

          const opacity = 1 - progress;

          dotElement.style.opacity =
            String(opacity);

          ringElement.style.opacity =
            String(opacity * 0.68);
        } else {
          dotElement.style.opacity = "0";
          ringElement.style.opacity = "0";

          visible.current = false;
        }
      }

      frame.current =
        requestAnimationFrame(render);
    };

    const moveTo = (
      x: number,
      y: number,
    ) => {
      target.current.x = x;
      target.current.y = y;

      lastInteraction.current =
        performance.now();

      visible.current = true;
    };

    /*
     * DESKTOP
     *
     * The actual mouse position becomes the target.
     * Rendering remains completely separate from the
     * event frequency.
     */
    const handleMouseMove = (
      event: MouseEvent,
    ) => {
      if (coarse) {
        return;
      }

      moveTo(
        event.clientX,
        event.clientY,
      );
    };

    /*
     * MOBILE
     *
     * A finger moving across the screen is NOT cursor
     * movement.
     *
     * We only record where the touch started.
     */
    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      if (!coarse) {
        return;
      }

      if (event.pointerType !== "touch") {
        return;
      }

      touchStart.current = {
        x: event.clientX,
        y: event.clientY,
      };

      touchMoved.current = false;
    };

    /*
     * NEVER update target here.
     *
     * This is what prevents the indicator from
     * following a finger during scrolling.
     */
    const handlePointerMove = (
      event: PointerEvent,
    ) => {
      if (!coarse) {
        return;
      }

      if (event.pointerType !== "touch") {
        return;
      }

      const dx =
        event.clientX -
        touchStart.current.x;

      const dy =
        event.clientY -
        touchStart.current.y;

      if (Math.hypot(dx, dy) > 10) {
        touchMoved.current = true;
      }
    };

    /*
     * Only a genuine tap places the indicator.
     */
    const handlePointerUp = (
      event: PointerEvent,
    ) => {
      if (!coarse) {
        return;
      }

      if (event.pointerType !== "touch") {
        return;
      }

      if (touchMoved.current) {
        return;
      }

      moveTo(
        event.clientX,
        event.clientY,
      );
    };

    const handlePointerCancel = (
      event: PointerEvent,
    ) => {
      if (
        coarse &&
        event.pointerType === "touch"
      ) {
        touchMoved.current = true;
      }
    };

    const handleMouseLeave = () => {
      if (coarse) {
        return;
      }

      visible.current = false;

      dotElement.style.opacity = "0";
      ringElement.style.opacity = "0";
    };

    window.addEventListener(
      "mousemove",
      handleMouseMove,
      { passive: true },
    );

    window.addEventListener(
      "pointerdown",
      handlePointerDown,
      { passive: true },
    );

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      { passive: true },
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp,
      { passive: true },
    );

    window.addEventListener(
      "pointercancel",
      handlePointerCancel,
      { passive: true },
    );

    window.addEventListener(
      "mouseleave",
      handleMouseLeave,
      { passive: true },
    );

    frame.current =
      requestAnimationFrame(render);

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove,
      );

      window.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp,
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerCancel,
      );

      window.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      );

      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, []);

  const glow = isTv
    ? "rgba(255,181,27,0.58)"
    : "rgba(22,131,255,0.58)";

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        className="
          pointer-events-none
          fixed
          left-0
          top-0
          z-[99999]
          h-[38px]
          w-[38px]
          rounded-full
        "
        style={{
          border: `1.5px solid ${accent}`,
          background: "rgba(255,255,255,0.025)",
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.12),
            0 0 8px ${accent},
            0 0 20px ${accent},
            0 0 38px ${glow}
          `,
          opacity: 0,
          willChange: "transform, opacity",
        }}
      />

      <div
        ref={dotRef}
        aria-hidden="true"
        className="
          pointer-events-none
          fixed
          left-0
          top-0
          z-[100000]
          h-[9px]
          w-[9px]
          rounded-full
        "
        style={{
          backgroundColor: "#ffffff",
          boxShadow: `
            0 0 0 2px ${accent},
            0 0 8px ${accent},
            0 0 18px ${accent},
            0 0 30px ${glow}
          `,
          opacity: 0,
          willChange: "transform, opacity",
        }}
      />
    </>
  );
        }
