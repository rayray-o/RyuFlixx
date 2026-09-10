"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Point = {
  x: number;
  y: number;
};

type PointerState = {
  startX: number;
  startY: number;
  moved: boolean;
  active: boolean;
};

export default function RyuFlixCursor() {
  const pathname = usePathname();

  const dotElementRef = useRef<HTMLDivElement | null>(null);
  const ringElementRef = useRef<HTMLDivElement | null>(null);

  const targetRef = useRef<Point>({ x: -200, y: -200 });

  const dotPositionRef = useRef<Point>({ x: -200, y: -200 });
  const ringPositionRef = useRef<Point>({ x: -200, y: -200 });

  const dotVelocityRef = useRef<Point>({ x: 0, y: 0 });
  const ringVelocityRef = useRef<Point>({ x: 0, y: 0 });

  const pointerStateRef = useRef<PointerState>({
    startX: 0,
    startY: 0,
    moved: false,
    active: false,
  });

  const visibleRef = useRef(false);
  const lastInteractionRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  const isTv =
    pathname.startsWith("/tv") ||
    pathname.includes("/tv/");

  const accent = isTv ? "#FFB51B" : "#1683FF";

  useEffect(() => {
    const coarsePointer = window.matchMedia(
      "(pointer: coarse)",
    ).matches;

    const dot = dotElementRef.current;
    const ring = ringElementRef.current;

    if (!dot || !ring) return;

    /*
     * DOT
     *
     * Fast, tight response.
     * It reaches the target quickly without looking
     * like it teleports.
     */
    const updateDot = () => {
      const position = dotPositionRef.current;
      const target = targetRef.current;
      const velocity = dotVelocityRef.current;

      const dx = target.x - position.x;
      const dy = target.y - position.y;

      velocity.x += dx * 0.42;
      velocity.y += dy * 0.42;

      velocity.x *= 0.68;
      velocity.y *= 0.68;

      position.x += velocity.x;
      position.y += velocity.y;
    };

    /*
     * RING
     *
     * Completely independent from the dot.
     *
     * Lower stiffness + higher inertia gives it
     * the graceful "comes after it" motion.
     */
    const updateRing = () => {
      const position = ringPositionRef.current;
      const target = targetRef.current;
      const velocity = ringVelocityRef.current;

      const dx = target.x - position.x;
      const dy = target.y - position.y;

      velocity.x += dx * 0.075;
      velocity.y += dy * 0.075;

      velocity.x *= 0.91;
      velocity.y *= 0.91;

      position.x += velocity.x;
      position.y += velocity.y;
    };

    const animate = () => {
      updateDot();
      updateRing();

      const dotPosition = dotPositionRef.current;
      const ringPosition = ringPositionRef.current;

      /*
       * translate3d keeps this on the compositor rather
       * than forcing layout on every animation frame.
       */
      dot.style.transform = `
        translate3d(
          ${dotPosition.x}px,
          ${dotPosition.y}px,
          0
        )
        translate(-50%, -50%)
      `;

      ring.style.transform = `
        translate3d(
          ${ringPosition.x}px,
          ${ringPosition.y}px,
          0
        )
        translate(-50%, -50%)
      `;

      /*
       * The cursor doesn't vanish immediately.
       * It remains visible after interaction and only
       * gently fades after a period of inactivity.
       */
      if (visibleRef.current) {
        const idleTime =
          performance.now() - lastInteractionRef.current;

        const fadeStart = 2200;
        const fadeDuration = 700;

        if (idleTime <= fadeStart) {
          dot.style.opacity = "1";
          ring.style.opacity = "0.72";
        } else if (idleTime < fadeStart + fadeDuration) {
          const progress =
            (idleTime - fadeStart) / fadeDuration;

          const eased =
            1 - progress * progress;

          dot.style.opacity = String(eased);
          ring.style.opacity = String(eased * 0.72);
        } else {
          dot.style.opacity = "0";
          ring.style.opacity = "0";
          visibleRef.current = false;
        }
      }

      animationFrameRef.current =
        requestAnimationFrame(animate);
    };

    const showAt = (x: number, y: number) => {
      /*
       * Do NOT instantly teleport either element.
       *
       * The target changes immediately, but both physical
       * bodies have to travel toward it.
       */
      targetRef.current.x = x;
      targetRef.current.y = y;

      lastInteractionRef.current =
        performance.now();

      visibleRef.current = true;

      /*
       * Give the dot a little extra initial velocity so
       * it arrives noticeably faster than the ring.
       */
      const dotPosition = dotPositionRef.current;

      dotVelocityRef.current.x +=
        (x - dotPosition.x) * 0.035;

      dotVelocityRef.current.y +=
        (y - dotPosition.y) * 0.035;
    };

    /*
     * DESKTOP
     *
     * Continuous mouse tracking.
     */
    const handleMouseMove = (event: MouseEvent) => {
      if (coarsePointer) return;

      showAt(event.clientX, event.clientY);
    };

    /*
     * MOBILE
     *
     * We deliberately DO NOT update the target during
     * touchmove.
     *
     * This is what prevents scrolling from dragging
     * the cursor around with the finger.
     */
    const handlePointerDown = (event: PointerEvent) => {
      if (!coarsePointer) return;

      if (event.pointerType !== "touch") return;

      pointerStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        active: true,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!coarsePointer) return;

      if (event.pointerType !== "touch") return;

      const state = pointerStateRef.current;

      if (!state.active) return;

      const dx =
        event.clientX - state.startX;

      const dy =
        event.clientY - state.startY;

      /*
       * Once the finger has moved enough to be a scroll,
       * this interaction is permanently ignored.
       */
      if (
        Math.sqrt(dx * dx + dy * dy) > 12
      ) {
        state.moved = true;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!coarsePointer) return;

      if (event.pointerType !== "touch") return;

      const state = pointerStateRef.current;

      if (!state.active) return;

      /*
       * Only a genuine tap moves the cursor.
       */
      if (!state.moved) {
        showAt(
          event.clientX,
          event.clientY,
        );
      }

      state.active = false;
    };

    const handlePointerCancel = (
      event: PointerEvent,
    ) => {
      if (!coarsePointer) return;

      if (event.pointerType !== "touch") return;

      pointerStateRef.current.active = false;
    };

    const handleMouseLeave = () => {
      if (coarsePointer) return;

      visibleRef.current = false;

      dot.style.opacity = "0";
      ring.style.opacity = "0";
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

    animationFrameRef.current =
      requestAnimationFrame(animate);

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

      if (
        animationFrameRef.current !== null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current,
        );
      }
    };
  }, []);

  return (
    <>
      {/* Momentum ring */}
      <div
        ref={ringElementRef}
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
            0 0 10px ${accent}55,
            0 0 24px ${accent}25,
            inset 0 0 8px ${accent}10
          `,
          opacity: 0,
          willChange:
            "transform, opacity",
        }}
      />

      {/* Fast dot */}
      <div
        ref={dotElementRef}
        aria-hidden="true"
        className="
          pointer-events-none
          fixed
          left-0
          top-0
          z-[100000]
          h-[10px]
          w-[10px]
          rounded-full
        "
        style={{
          backgroundColor: accent,
          boxShadow: `
            0 0 7px ${accent},
            0 0 16px ${accent}aa,
            0 0 28px ${accent}44
          `,
          opacity: 0,
          willChange:
            "transform, opacity",
        }}
      />
    </>
  );
          }
