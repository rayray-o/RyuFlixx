"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Point = {
  x: number;
  y: number;
};

export default function RyuFlixCursor() {
  const pathname = usePathname();

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const target = useRef<Point>({
    x: -100,
    y: -100,
  });

  const dot = useRef<Point>({
    x: -100,
    y: -100,
  });

  const ring = useRef<Point>({
    x: -100,
    y: -100,
  });

  const dotVelocity = useRef<Point>({
    x: 0,
    y: 0,
  });

  const ringVelocity = useRef<Point>({
    x: 0,
    y: 0,
  });

  const visible = useRef(false);
  const lastInteraction = useRef(0);
  const frame = useRef<number | null>(null);

  const touchStart = useRef<Point>({
    x: 0,
    y: 0,
  });

  const touchMoved = useRef(false);

  const isTv =
    pathname.startsWith("/tv") ||
    pathname.includes("/tv/");

  const accent = isTv
    ? "#FFB51B"
    : "#1683FF";

  useEffect(() => {
    const dotElement = dotRef.current;
    const ringElement = ringRef.current;

    if (!dotElement || !ringElement) {
      return;
    }

    const coarse =
      window.matchMedia(
        "(pointer: coarse)",
      ).matches;

    /*
     * This is intentionally NOT a spring.
     *
     * The dot is simply a fast eased follower.
     * There is no oscillation and no bounce.
     */
    const updateDot = () => {
      const dx =
        target.current.x -
        dot.current.x;

      const dy =
        target.current.y -
        dot.current.y;

      dotVelocity.current.x =
        dotVelocity.current.x * 0.62 +
        dx * 0.38;

      dotVelocity.current.y =
        dotVelocity.current.y * 0.62 +
        dy * 0.38;

      dot.current.x +=
        dotVelocity.current.x;

      dot.current.y +=
        dotVelocity.current.y;
    };

    /*
     * The ring is deliberately much heavier.
     *
     * It does NOT bounce around the dot.
     * It simply has more inertia and therefore
     * arrives gracefully after the dot.
     */
    const updateRing = () => {
      const dx =
        target.current.x -
        ring.current.x;

      const dy =
        target.current.y -
        ring.current.y;

      ringVelocity.current.x =
        ringVelocity.current.x * 0.82 +
        dx * 0.18;

      ringVelocity.current.y =
        ringVelocity.current.y * 0.82 +
        dy * 0.18;

      ring.current.x +=
        ringVelocity.current.x;

      ring.current.y +=
        ringVelocity.current.y;
    };

    const render = () => {
      updateDot();
      updateRing();

      dotElement.style.transform =
        `translate3d(${dot.current.x}px, ${dot.current.y}px, 0) translate(-50%, -50%)`;

      ringElement.style.transform =
        `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;

      if (visible.current) {
        const elapsed =
          performance.now() -
          lastInteraction.current;

        /*
         * Stay fully visible for a while.
         * Then fade instead of abruptly disappearing.
         */
        if (elapsed < 2600) {
          dotElement.style.opacity = "1";
          ringElement.style.opacity = "0.72";
        } else if (elapsed < 3400) {
          const progress =
            (elapsed - 2600) / 800;

          const opacity =
            1 - progress;

          dotElement.style.opacity =
            String(opacity);

          ringElement.style.opacity =
            String(opacity * 0.72);
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

      /*
       * No teleporting.
       *
       * Both elements travel toward the new
       * target using their own existing velocity.
       */
    };

    /*
     * DESKTOP
     *
     * Continuous cursor movement.
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
     * We ONLY remember where the finger began.
     *
     * We never move the cursor during touchmove.
     * Therefore scrolling cannot drag the cursor.
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

      /*
       * Once this is a scroll gesture,
       * completely ignore the interaction.
       */
      if (
        Math.hypot(dx, dy) > 10
      ) {
        touchMoved.current = true;
      }
    };

    const handlePointerUp = (
      event: PointerEvent,
    ) => {
      if (!coarse) {
        return;
      }

      if (event.pointerType !== "touch") {
        return;
      }

      /*
       * Only an actual tap changes the cursor.
       *
       * A scroll never gets here as a cursor movement.
       */
      if (!touchMoved.current) {
        moveTo(
          event.clientX,
          event.clientY,
        );
      }
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

  return (
    <>
      {/* Independent trailing ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="
          pointer-events-none
          fixed
          left-0
          top-0
          z-[99999]
          h-[34px]
          w-[34px]
          rounded-full
        "
        style={{
          border: `1px solid ${accent}`,
          boxShadow: `
            0 0 8px ${accent}66,
            0 0 20px ${accent}33
          `,
          opacity: 0,
          willChange:
            "transform, opacity",
        }}
      />

      {/* Fast central dot */}
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
          backgroundColor: accent,
          boxShadow: `
            0 0 6px ${accent},
            0 0 15px ${accent}aa,
            0 0 24px ${accent}44
          `,
          opacity: 0,
          willChange:
            "transform, opacity",
        }}
      />
    </>
  );
        }
