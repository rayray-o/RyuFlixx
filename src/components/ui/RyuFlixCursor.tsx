"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Point = {
  x: number;
  y: number;
};

export default function RyuFlixCursor() {
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const targetRef = useRef<Point>({
    x: -100,
    y: -100,
  });

  const dotRef = useRef<Point>({
    x: -100,
    y: -100,
  });

  const ringRef = useRef<Point>({
    x: -100,
    y: -100,
  });

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const animationFrameRef = useRef<number | null>(null);

  const isTv =
    pathname.startsWith("/tv") ||
    pathname.includes("/tv/");

  const accent = isTv ? "#FFB51B" : "#1683FF";

  useEffect(() => {
    const coarsePointer = window.matchMedia(
      "(pointer: coarse)",
    ).matches;

    setIsTouchDevice(coarsePointer);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const showTouchDot = (x: number, y: number) => {
      targetRef.current = { x, y };
      dotRef.current = { x, y };
      ringRef.current = { x, y };

      setVisible(true);
      setHovering(false);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 650);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (coarsePointer) {
        return;
      }

      targetRef.current.x = event.clientX;
      targetRef.current.y = event.clientY;

      setVisible(true);

      const element = event.target;

      if (element instanceof Element) {
        const interactive = element.closest(
          "a, button, input, select, textarea, [role='button'], [data-cursor-hover]",
        );

        setHovering(Boolean(interactive));
      }
    };

    const handleMouseLeave = () => {
      if (!coarsePointer) {
        setVisible(false);
        setHovering(false);
      }
    };

    /*
     * IMPORTANT:
     *
     * On touch devices we intentionally listen ONLY to touchstart.
     *
     * We DO NOT listen to touchmove.
     *
     * This means the dot appears where the user initially taps,
     * but it never follows their finger while scrolling.
     */
    const handleTouchStart = (event: TouchEvent) => {
      if (!coarsePointer) {
        return;
      }

      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      showTouchDot(touch.clientX, touch.clientY);
    };

    const handlePointerDown = () => {
      if (coarsePointer) {
        return;
      }

      setPressed(true);

      window.setTimeout(() => {
        setPressed(false);
      }, 160);
    };

    const animate = () => {
      if (!coarsePointer && !reducedMotion) {
        const target = targetRef.current;

        dotRef.current.x +=
          (target.x - dotRef.current.x) * 0.42;

        dotRef.current.y +=
          (target.y - dotRef.current.y) * 0.42;

        ringRef.current.x +=
          (target.x - ringRef.current.x) * 0.13;

        ringRef.current.y +=
          (target.y - ringRef.current.y) * 0.13;
      }

      const dot = document.getElementById(
        "ryuflix-cursor-dot",
      );

      const ring = document.getElementById(
        "ryuflix-cursor-ring",
      );

      if (dot) {
        dot.style.transform = `translate3d(${dotRef.current.x}px, ${dotRef.current.y}px, 0) translate(-50%, -50%)`;
      }

      if (ring) {
        ring.style.transform = `translate3d(${ringRef.current.x}px, ${ringRef.current.y}px, 0) translate(-50%, -50%)`;
      }

      animationFrameRef.current =
        requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown);

    animationFrameRef.current =
      requestAnimationFrame(animate);

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove,
      );

      window.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      );

      window.removeEventListener(
        "touchstart",
        handleTouchStart,
      );

      window.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(
          animationFrameRef.current,
        );
      }

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Desktop outer follower */}
      <div
        id="ryuflix-cursor-ring"
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[99999] hidden h-9 w-9 rounded-full md:block"
        style={{
          border: `1px solid ${accent}`,
          boxShadow: `
            0 0 14px ${accent}55,
            inset 0 0 10px ${accent}12
          `,
          opacity: visible ? 0.72 : 0,
          scale:
            hovering || pressed
              ? "1.5"
              : "1",
          transition: [
            "opacity 160ms ease",
            "scale 180ms cubic-bezier(0.22, 1, 0.36, 1)",
            "border-color 300ms ease",
            "box-shadow 300ms ease",
          ].join(", "),
          willChange: "transform",
        }}
      />

      {/* Main dot */}
      <div
        id="ryuflix-cursor-dot"
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100000] h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: accent,
          boxShadow: `
            0 0 7px ${accent},
            0 0 17px ${accent}99
          `,
          opacity: visible ? 1 : 0,
          scale:
            pressed
              ? "1.65"
              : hovering
                ? "1.2"
                : "1",
          transition: [
            "opacity 120ms ease",
            "scale 140ms cubic-bezier(0.22, 1, 0.36, 1)",
            "background-color 300ms ease",
            "box-shadow 300ms ease",
          ].join(", "),
          willChange: "transform",
        }}
      />
    </>
  );
}
